import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import prisma from '../config/database';
import logger from '../utils/logger';

interface AvatarPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

class GroupAvatarService {
  private readonly avatarSize = 100; // Each avatar size
  private readonly gap = 5; // Gap between avatars (increased from 2 to 5)

  /**
   * Get grid layout based on member count
   */
  private getGridLayout(memberCount: number): { cols: number; rows: number; positions: AvatarPosition[], outputWidth: number, outputHeight: number } {
    const positions: AvatarPosition[] = [];

    // Determine grid size based on member count
    let cols = 1;
    let rows = 1;

    if (memberCount === 1) {
      cols = 1;
      rows = 1;
    } else if (memberCount === 2) {
      cols = 2;
      rows = 1;
    } else if (memberCount === 3) {
      cols = 2;
      rows = 2;
    } else if (memberCount <= 4) {
      cols = 2;
      rows = 2;
    } else if (memberCount <= 6) {
      cols = 3;
      rows = 2;
    } else {
      cols = 3;
      rows = 3;
    }

    // Calculate the output size based on grid dimensions and gaps
    const outputWidth = cols * this.avatarSize + (cols - 1) * this.gap;
    const outputHeight = rows * this.avatarSize + (rows - 1) * this.gap;

    // Generate positions for each member
    for (let i = 0; i < Math.min(memberCount, 9); i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push({
        x: col * (this.avatarSize + this.gap),
        y: row * (this.avatarSize + this.gap),
        width: this.avatarSize,
        height: this.avatarSize,
      });
    }

    return { cols, rows, positions, outputWidth, outputHeight };
  }

  /**
   * Read avatar from local file system
   */
  private async readLocalAvatar(avatarUrl: string, userId: string): Promise<Buffer | null> {
    try {
      logger.info('[GroupAvatarService] readLocalAvatar: Starting for user:', userId, 'avatarUrl:', avatarUrl);

      // avatarUrl is like: /uploads/avatars/xxx.jpg
      // Convert to absolute path
      const absolutePath = path.join(__dirname, '../../', avatarUrl);
      logger.info('[GroupAvatarService] readLocalAvatar: Absolute path:', absolutePath);

      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        logger.warn('[GroupAvatarService] readLocalAvatar: File not exists:', absolutePath);
        return null;
      }

      // Read file
      const buffer = fs.readFileSync(absolutePath);
      logger.info('[GroupAvatarService] readLocalAvatar: Read', buffer.length, 'bytes');

      // Resize and crop to square, ensuring it fills the allocated space
      logger.info('[GroupAvatarService] readLocalAvatar: Processing with sharp...');
      const processed = await sharp(buffer)
        .resize(this.avatarSize, this.avatarSize, {
          fit: 'cover',
          position: 'center',
        })
        .toBuffer();

      logger.info('[GroupAvatarService] readLocalAvatar: Processed to', processed.length, 'bytes');
      return processed;
    } catch (error: any) {
      logger.error('[GroupAvatarService] readLocalAvatar: Error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        userId,
        avatarUrl,
      });
      return null;
    }
  }

  /**
   * Generate group avatar from member avatars
   */
  async generateGroupAvatar(groupId: string): Promise<string | null> {
    try {
      logger.info('[GroupAvatarService] === generateGroupAvatar START ===');
      logger.info('[GroupAvatarService] Group ID:', groupId);

      // Get group members with their avatars (limit to 9)
      logger.info('[GroupAvatarService] Fetching group members from DB...');
      const groupMembers = await prisma.groupMember.findMany({
        where: { groupId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        take: 9,
        orderBy: { joinedAt: 'asc' },
      });

      logger.info('[GroupAvatarService] Fetched members:', groupMembers.length);
      groupMembers.forEach((m, i) => {
        logger.info(`[GroupAvatarService] Member ${i}:`, {
          userId: m.user.id,
          name: m.user.name,
          avatarUrl: m.user.avatarUrl
        });
      });

      if (groupMembers.length === 0) {
        logger.warn('[GroupAvatarService] No members found for group:', groupId);
        return null;
      }

      logger.info('[GroupAvatarService] Generating avatar for group:', groupId, 'members:', groupMembers.length);

      // Download and process member avatars
      const avatarBuffers: { buffer: Buffer; position: AvatarPosition }[] = [];

      const layout = this.getGridLayout(groupMembers.length);
      logger.info('[GroupAvatarService] Grid layout:', {
        cols: layout.cols,
        rows: layout.rows,
        outputWidth: layout.outputWidth,
        outputHeight: layout.outputHeight
      });

      for (let i = 0; i < groupMembers.length; i++) {
        const member = groupMembers[i];
        const position = layout.positions[i];

        logger.info('[GroupAvatarService] Processing member:', i, member.user.id);

        if (!member.user.avatarUrl) {
          logger.info('[GroupAvatarService] No avatar URL for member:', member.user.id, 'generating placeholder');
          const placeholder = await this.generatePlaceholderAvatar(member.user.name);
          avatarBuffers.push({ buffer: placeholder, position });
          logger.info('[GroupAvatarService] Placeholder generated for member:', member.user.id);
          continue;
        }

        logger.info('[GroupAvatarService] Reading local avatar for member:', member.user.id, 'URL:', member.user.avatarUrl);
        const buffer = await this.readLocalAvatar(member.user.avatarUrl, member.user.id);
        if (buffer) {
          avatarBuffers.push({ buffer, position });
          logger.info('[GroupAvatarService] Avatar downloaded for member:', member.user.id);
        } else {
          logger.warn('[GroupAvatarService] Avatar download failed for member:', member.user.id, 'using placeholder');
          const placeholder = await this.generatePlaceholderAvatar(member.user.name);
          avatarBuffers.push({ buffer: placeholder, position });
          logger.info('[GroupAvatarService] Placeholder generated for member:', member.user.id);
        }
      }

      logger.info('[GroupAvatarService] All avatars processed, count:', avatarBuffers.length);

      // Create a white background canvas first with dynamic size
      logger.info('[GroupAvatarService] Creating background canvas...');
      const backgroundCanvas = await sharp({
        create: {
          width: layout.outputWidth,
          height: layout.outputHeight,
          channels: 3, // RGB (no alpha for Jpeg)
          background: { r: 255, g: 255, b: 255 }, // White background
        },
      })
      .png()
      .toBuffer();

      logger.info('[GroupAvatarService] Background canvas created');

      // Create composite image
      const compositeInputs = avatarBuffers.map(({ buffer, position }) => ({
        input: buffer,
        top: position.y,
        left: position.x,
      }));

      logger.info('[GroupAvatarService] Compositing avatars...');
      // Composite all avatars onto the white background
      const result = await sharp(backgroundCanvas)
        .composite(compositeInputs)
        .png()
        .toBuffer();

      logger.info('[GroupAvatarService] Composite completed, size:', result.length, 'bytes');

      // Save to file
      const avatarDir = path.join(__dirname, '../../uploads/avatars/groups');
      logger.info('[GroupAvatarService] Avatar directory:', avatarDir);

      if (!fs.existsSync(avatarDir)) {
        logger.info('[GroupAvatarService] Creating avatar directory...');
        fs.mkdirSync(avatarDir, { recursive: true });
      }

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const filename = `group_${groupId}_${timestamp}_${randomSuffix}.png`;
      const filepath = path.join(avatarDir, filename);

      logger.info('[GroupAvatarService] Saving avatar to:', filepath);
      fs.writeFileSync(filepath, result);
      logger.info('[GroupAvatarService] Avatar saved successfully');

      const avatarUrl = `/uploads/avatars/groups/${filename}`;

      // Update group avatarUrl in database
      logger.info('[GroupAvatarService] Updating group avatar in DB...');
      await prisma.group.update({
        where: { id: groupId },
        data: { avatarUrl },
      });

      logger.info('[GroupAvatarService] Group avatar generated:', avatarUrl);

      // Clean up old group avatars
      logger.info('[GroupAvatarService] Cleaning up old avatars...');
      await this.cleanupOldAvatars(groupId, filename);

      logger.info('[GroupAvatarService] === generateGroupAvatar END ===');
      return avatarUrl;
    } catch (error: any) {
      logger.error('[GroupAvatarService] Generate group avatar error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      return null;
    }
  }

  /**
   * Generate placeholder avatar with user's initial
   */
  private async generatePlaceholderAvatar(userName: string): Promise<Buffer> {
    const initial = userName.charAt(0).toUpperCase();
    
    // Generate colored background based on name
    const hue = this.stringToHue(userName);
    const backgroundColor = `hsl(${hue}, 70%, 60%)`;
    
    return sharp({
      create: {
        width: this.avatarSize,
        height: this.avatarSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
    .composite([
      {
        input: await sharp({
          create: {
            width: this.avatarSize,
            height: this.avatarSize,
            channels: 3,
            background: this.hslToRgb(hue, 70, 60),
          },
        })
        .toBuffer(),
        top: 0,
        left: 0,
      },
      {
        input: Buffer.from(`
          <svg width="${this.avatarSize}" height="${this.avatarSize}">
            <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" 
                  font-family="Arial" font-size="48" font-weight="bold" fill="white">
              ${initial}
            </text>
          </svg>
        `),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
  }

  /**
   * Convert string to hue value (0-360)
   */
  private stringToHue(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 360);
  }

  /**
   * Convert HSL to RGB
   */
  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: Math.round(255 * f(0)), g: Math.round(255 * f(8)), b: Math.round(255 * f(4)) };
  }

  /**
   * Clean up old group avatars
   */
  private async cleanupOldAvatars(groupId: string, currentFilename: string): Promise<void> {
    try {
      const avatarDir = path.join(__dirname, '../../uploads/avatars/groups');
      if (!fs.existsSync(avatarDir)) return;

      const files = fs.readdirSync(avatarDir);
      const pattern = new RegExp(`^group_${groupId}_[0-9]+_[a-z0-9]+\\.png$`);

      for (const file of files) {
        if (pattern.test(file) && file !== currentFilename) {
          const filePath = path.join(avatarDir, file);
          fs.unlinkSync(filePath);
          logger.info('[GroupAvatarService] Cleaned up old group avatar:', file);
        }
      }
    } catch (error: any) {
      logger.warn('[GroupAvatarService] Cleanup old avatars error:', error.message);
    }
  }
}

export default new GroupAvatarService();

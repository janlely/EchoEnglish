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
  private readonly gap = 2; // Gap between avatars
  private readonly outputSize = 300; // 3x3 grid output size

  /**
   * Get grid layout based on member count
   */
  private getGridLayout(memberCount: number): { cols: number; rows: number; positions: AvatarPosition[] } {
    const positions: AvatarPosition[] = [];
    const cellSize = this.avatarSize;

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

    // Calculate starting offset to center the grid
    const totalWidth = cols * cellSize + (cols - 1) * this.gap;
    const totalHeight = rows * cellSize + (rows - 1) * this.gap;
    const startX = (this.outputSize - totalWidth) / 2;
    const startY = (this.outputSize - totalHeight) / 2;

    // Generate positions for each member
    for (let i = 0; i < Math.min(memberCount, 9); i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push({
        x: startX + col * (cellSize + this.gap),
        y: startY + row * (cellSize + this.gap),
        width: cellSize,
        height: cellSize,
      });
    }

    return { cols, rows, positions };
  }

  /**
   * Download and save avatar from URL
   */
  private async downloadAvatar(url: string, userId: string): Promise<Buffer | null> {
    try {
      // Handle relative URLs
      const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
      
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to download avatar: ${response.status}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Resize and crop to square
      const processed = await sharp(buffer)
        .resize(this.avatarSize, this.avatarSize, {
          fit: 'cover',
          position: 'center',
        })
        .toBuffer();
      
      return processed;
    } catch (error: any) {
      logger.error('[GroupAvatarService] Download avatar error:', error.message);
      return null;
    }
  }

  /**
   * Generate group avatar from member avatars
   */
  async generateGroupAvatar(groupId: string): Promise<string | null> {
    try {
      // Get group members with their avatars (limit to 9)
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

      if (groupMembers.length === 0) {
        logger.warn('[GroupAvatarService] No members found for group:', groupId);
        return null;
      }

      logger.info('[GroupAvatarService] Generating avatar for group:', groupId, 'members:', groupMembers.length);

      // Download and process member avatars
      const avatarBuffers: { buffer: Buffer; position: AvatarPosition }[] = [];
      
      const layout = this.getGridLayout(groupMembers.length);

      for (let i = 0; i < groupMembers.length; i++) {
        const member = groupMembers[i];
        const position = layout.positions[i];
        
        if (!member.user.avatarUrl) {
          // Generate placeholder avatar for user without avatar
          const placeholder = await this.generatePlaceholderAvatar(member.user.name);
          avatarBuffers.push({ buffer: placeholder, position });
          continue;
        }

        const buffer = await this.downloadAvatar(member.user.avatarUrl, member.user.id);
        if (buffer) {
          avatarBuffers.push({ buffer, position });
        } else {
          // Fallback to placeholder
          const placeholder = await this.generatePlaceholderAvatar(member.user.name);
          avatarBuffers.push({ buffer: placeholder, position });
        }
      }

      // Create composite image
      const compositeInputs = avatarBuffers.map(({ buffer, position }) => ({
        input: buffer,
        top: position.y,
        left: position.x,
      }));

      // Create white background
      const background = await sharp({
        create: {
          width: this.outputSize,
          height: this.outputSize,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
      .png()
      .toBuffer();

      // Composite all avatars
      const result = await sharp(background)
        .composite(compositeInputs)
        .png()
        .toBuffer();

      // Save to file
      const avatarDir = path.join(__dirname, '../../uploads/avatars/groups');
      if (!fs.existsSync(avatarDir)) {
        fs.mkdirSync(avatarDir, { recursive: true });
      }

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const filename = `group_${groupId}_${timestamp}_${randomSuffix}.png`;
      const filepath = path.join(avatarDir, filename);

      fs.writeFileSync(filepath, result);

      const avatarUrl = `/uploads/avatars/groups/${filename}`;

      // Update group avatarUrl in database
      await prisma.group.update({
        where: { id: groupId },
        data: { avatarUrl },
      });

      logger.info('[GroupAvatarService] Group avatar generated:', avatarUrl);

      // Clean up old group avatars
      await this.cleanupOldAvatars(groupId, filename);

      return avatarUrl;
    } catch (error: any) {
      logger.error('[GroupAvatarService] Generate group avatar error:', error.message);
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

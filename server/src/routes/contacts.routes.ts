import { Router } from 'express';
import contactsController from '../controllers/contacts.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All contacts routes are protected
router.use(authMiddleware);

// Contact sync
router.get('/sync', contactsController.syncContacts);

// Friends
router.get('/friends', contactsController.getFriends);

// Groups
router.get('/groups', contactsController.getGroups);
router.get('/groups/:groupId', contactsController.getGroup);
router.post('/groups', contactsController.createGroup);
router.post('/groups/:groupId/members', contactsController.addGroupMember);
router.delete('/groups/:groupId/members', contactsController.removeGroupMember);

export default router;

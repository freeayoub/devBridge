const DataLoader = require("dataloader");
const mongoose = require("mongoose");
const User = require("../models/User");
const GroupConversation = require("../models/groupConversation.model");
const Message = require("../models/message.model");
const Conversation = require("../models/conversation.model");

const createUserLoader = () => {
  return new DataLoader(async (userIds) => {
    const users = await User.find({
      _id: {
        $in: userIds.map((id) =>
          mongoose.Types.ObjectId.createFromHexString(id)
        ),
      },
    }).lean();

    return userIds.map(
      (id) => users.find((u) => u._id.toString() === id.toString()) || null
    );
  });
};

const createGroupLoader = () =>
  new DataLoader(async (groupIds) => {
    const groups = await GroupConversation.find({ _id: { $in: groupIds } });
    const groupMap = groups.reduce((map, group) => {
      map[group._id.toString()] = group;
      return map;
    }, {});
    return groupIds.map((id) => groupMap[id] || null);
  });

const createMessageLoader = () =>
  new DataLoader(async (messageIds) => {
    const messages = await Message.find({ _id: { $in: messageIds } });
    const messageMap = messages.reduce((map, message) => {
      map[message._id.toString()] = message;
      return map;
    }, {});
    return messageIds.map((id) => messageMap[id] || null);
  });

const createConversationLoader = () =>
  new DataLoader(async (conversationIds) => {
    const conversations = await Conversation.find({
      _id: { $in: conversationIds },
    });
    const conversationMap = conversations.reduce((map, conversation) => {
      map[conversation._id.toString()] = conversation;
      return map;
    }, {});
    return conversationIds.map((id) => conversationMap[id] || null);
  });

module.exports = {
  createUserLoader,
  createGroupLoader,
  createMessageLoader,
  createConversationLoader,
};

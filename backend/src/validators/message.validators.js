const yup = require('yup');

exports.messageSchema = yup.object().shape({
  senderId: yup
    .string()
    .required('L\'ID de l\'expéditeur est obligatoire')
    .matches(/^[0-9a-fA-F]{24}$/, 'Format d\'ID expéditeur invalide'),
    
  receiverId: yup
    .string()
    .required('L\'ID du destinataire est obligatoire')
    .matches(/^[0-9a-fA-F]{24}$/, 'Format d\'ID destinataire invalide')
    .notOneOf([yup.ref('senderId')], 'Vous ne pouvez pas vous envoyer un message à vous-même'),
    
  content: yup
    .string()
    .required('Le contenu du message est obligatoire')
    .max(500, 'Le message ne peut pas dépasser 500 caractères')
    .trim(),
    
  fileUrl: yup
    .string()
    .url('URL de fichier invalide')
    .nullable(),
    
  conversationId: yup
    .string()
    .matches(/^[0-9a-fA-F]{24}$/, 'Format d\'ID de conversation invalide')
    .nullable(),
  
  type: yup
    .string()
    .oneOf(['text', 'image', 'video', 'file', 'audio', 'system'], 'Type de message invalide')
    .default('text'),

  status: yup
    .string()
    .oneOf(['sending', 'sent', 'delivered', 'read', 'failed'], 'Statut du message invalide')
    .default('sending')
});

exports.messageUpdateSchema = yup.object().shape({
  isRead: yup
    .boolean()
    .required('Le statut de lecture est obligatoire')
});
// utils/validators.js
const yup = require('yup');

// Validation user Schema with Yup 
const userValidationSchema = yup.object().shape({
    username: yup
        .string()
        .required('Le nom d\'utilisateur est obligatoire')
        .min(3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères')
        .max(30, 'Le nom d\'utilisateur ne peut pas dépasser 30 caractères')
        .matches(
            /^[a-zA-Z0-9_ ]+$/,
            'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, underscores et espaces'
        )
        .trim(),
        
    email: yup
        .string()
        .required('L\'email est obligatoire')
        .email('Veuillez entrer un email valide')
        .matches(
            /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|fr|tn|net)$/,
            'Seuls les domaines .com, .fr, .tn et .net sont acceptés'
        )
        .max(100, 'L\'email ne peut pas dépasser 100 caractères')
        .trim(),
        
    password: yup
        .string()
        .required('Le mot de passe est obligatoire')
        .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
        .max(50, 'Le mot de passe ne peut pas dépasser 50 caractères'),
        
    role: yup
        .string()
        .oneOf(
            ['student', 'tutor', 'admin'], 
            'Le rôle doit être soit "student", "tutor" ou "admin"'
        ),
        
    isOnline: yup
        .boolean()
        .default(false)
        .nullable(),
        
    createdAt: yup
        .date()
        .default(() => new Date())
});

// Schema for user update (less strict than creation)
const userUpdateSchema = yup.object().shape({
    username: yup
        .string()
        .min(3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères')
        .max(30, 'Le nom d\'utilisateur ne peut pas dépasser 30 caractères')
        .matches(
            /^[a-zA-Z0-9_ ]+$/, 
            'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, underscores et espaces'
        )
        .trim()
        .notRequired(),
        
    email: yup
        .string()
        .email('Veuillez entrer un email valide')
        .max(100, 'L\'email ne peut pas dépasser 100 caractères')
        .trim()
        .notRequired(),
        
    password: yup
        .string()
        .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
        .max(50, 'Le mot de passe ne peut pas dépasser 50 caractères')
        .matches(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
            'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'
        )
        .notRequired(),
        
    role: yup
        .string()
        .oneOf(
            ['student', 'tutor', 'admin'], 
            'Le rôle doit être soit "student", "tutor" ou "admin"'
        )
        .notRequired(),
        
    isOnline: yup
        .boolean()
        .nullable()
        .notRequired()
});

const messageSchema = yup.object().shape({
    senderId: yup.string().required(),
    receiverId: yup.string().required(),
    content: yup.string().required(),
});

module.exports = { 
    userValidationSchema, 
    userUpdateSchema,
    messageSchema 
};
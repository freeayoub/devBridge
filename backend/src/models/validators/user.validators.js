const yup = require('yup');

// Liste des rôles autorisés avec 'student' comme valeur par défaut
const roles = ['student', 'tutor', 'admin', 'alumni'];
const defaultRole = 'student';

// Schéma pour le nom d'utilisateur
const usernameSchema = yup
  .string()
  .required('Le nom d\'utilisateur est obligatoire')
  .min(3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères')
  .max(30, 'Le nom d\'utilisateur ne peut pas dépasser 30 caractères')
  .matches(
    /^[a-zA-Z0-9_]+( [a-zA-Z0-9_]+)*$/, // Permet des espaces mais pas au début/fin
    'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores'
  )
  .trim()
  .strict();

// Schéma pour l'email
const emailSchema = yup
  .string()
  .required('L\'email est obligatoire')
  .email('Veuillez entrer un email valide')
  .matches(
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|fr|tn|net)$/,
    'Seuls les domaines .com, .fr, .tn et .net sont acceptés'
  )
  .max(100, 'L\'email ne peut pas dépasser 100 caractères')
  .trim()
  .lowercase()
  .strict();

// Schéma pour le mot de passe
const passwordSchema = yup
  .string()
  .required('Le mot de passe est obligatoire')
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(50, 'Le mot de passe ne peut pas dépasser 50 caractères')
  .matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    'Le mot de passe doit contenir au moins :\n' +
    '- Une lettre majuscule\n' +
    '- Une lettre minuscule\n' +
    '- Un chiffre\n' +
    '- Un caractère spécial (@$!%*?&)'
  );
const imageSchema= yup
    .string()
    .nullable()
    .url('URL d\'image invalide')
    .max(500, 'L\'URL de l\'image ne peut pas dépasser 500 caractères')
// Schéma pour le rôle avec valeur par défaut
const roleSchema = yup
  .string()
  .oneOf(roles, `Le rôle doit être l'un des suivants: ${roles.join(', ')}`)
  .default(defaultRole)
  .transform(value => !value ? defaultRole : value); // Force la valeur par défaut si vide

// Schéma pour la création d'utilisateur
exports.userValidationSchema = yup.object().shape({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  image:imageSchema,
  role: roleSchema,
  isActive: yup.boolean().default(true),
  isOnline: yup.boolean().default(false)
}).noUnknown(); // Rejette les champs non définis

// Schéma pour la mise à jour d'utilisateur
exports.userUpdateSchema = yup.object().shape({
  username: usernameSchema.notRequired(),
  email: emailSchema.notRequired(),
  currentPassword: yup.string().when('newPassword', {
    is: newPassword => !!newPassword,
    then: yup.string().required('Le mot de passe actuel est requis pour le changement')
  }),
  newPassword: passwordSchema.notRequired(),
  role: roleSchema.notRequired(),
  isActive: yup.boolean(),
  isOnline: yup.boolean()
}).noUnknown(); // Rejette les champs non définis

// Export des constantes
exports.roles = roles;
exports.defaultRole = defaultRole;
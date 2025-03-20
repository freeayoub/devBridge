const cloudinary = require("../config/cloudinaryConfig");
const mime = require("mime-types");

const uploadFile = async (stream, filename) => {
  try {
    // Déterminer le type de contenu dynamiquement
    const contentType = mime.lookup(filename) || "application/octet-stream";
    // Chemin du fichier dans Firebase Storage
    const filePath = `uploads/${Date.now()}-${filename}`;
    // Fonction de retour pour le stream d'upload vers Cloudinary
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "auto", // Utilisation automatique du type de fichier (image, vidéo, etc.)
          public_id: filePath, // Nom du fichier dans Cloudinary
          mime_type: contentType, // Type MIME
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve(result); // Renvoie le résultat de l'upload
        }
      );
      // Envoi du flux vers Cloudinary
      stream.pipe(uploadStream);
    });
    // Attente que le fichier soit téléchargé
    const uploadResult = await uploadPromise;

    // console.log("File uploaded successfully to Cloudinary:", uploadResult);

    // Retourner l'URL sécurisé du fichier téléchargé
    return uploadResult.secure_url; // URL accessible publiquement
  } catch (error) {
    console.error("Error uploading file to Cloudinary:", error);
    throw new Error("Failed to upload file to Cloudinary");
  }
};

module.exports = uploadFile;


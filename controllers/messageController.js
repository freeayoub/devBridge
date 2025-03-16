const fs =require("fs")
const uploadFile = require("../services/messageService");

const uploadSingleFile = async (req, res) => {

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    // Lire le fichier local en tant que stream
    const stream =fs.createReadStream(req.file.path)
    const filename = req.file.filename;
    try {
    // Téléverser le fichier
    const fileUrl = await uploadFile(stream,filename);
    // Supprimer le fichier local après l'upload
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting local file:", err);
    });
    // Réponse avec l'URL du fichier
    res.json({ message: "File uploaded successfully", fileUrl });
  } catch (error) {
    console.error("Error in uploadSingleFile:", error);
    res.status(500).json({ error: error.message });
  }
};
module.exports = uploadSingleFile;

const express = require('express');
const axios = require('axios');
const router = express.Router();

// Define the POST route to handle evaluation requests
router.post('/evaluate/:teamId', async (req, res) => {
    const teamId = req.params.teamId;
    const projectPath = req.body.projectPath; // Assume the project path is provided in the request body

    try {
        // Make a request to the Flask API to evaluate the project
        const response = await axios.post(`http://127.0.0.1:5000/evaluate/${teamId}`, {
            project_path: projectPath
        });
        // Send the response back to the client
        res.status(200).json(response.data);
    } catch (error) {
        // Handle errors if the Flask API request fails
        res.status(500).json({ message: "Error evaluating the project", error: error.message });
    }
});

module.exports = router;
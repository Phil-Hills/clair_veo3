const express = require('express');
const { VertexAI } = require('@google-cloud/vertexai');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION,
  googleAuthOptions: {
    keyFilename: path.resolve(process.env.CREDENTIALS_PATH),
  },
});

const generativeModel = vertexAI.getGenerativeModel({
  model: 'veo-3.0-generate-preview',
});

app.post('/api/veo/generate', async (req, res) =
  try {
    const { prompt, imageBase64, mimeType, aspectRatio, durationSeconds, generateAudio } = req.body;
    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    const request = {
      endpoint: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/${process.env.GOOGLE_CLOUD_LOCATION}/publishers/google/models/veo-3.0-generate-preview`,
      instances: [
        {
          prompt,
          parameters: {
            aspectRatio,
            durationSeconds,
            generateAudio,
          },
        },
      ],
    };

    const response = await generativeModel.generateContent(request);
    const operationId = response.response.operation?.name;

    if (!operationId) {
      return res.status(500).json({ message: 'Failed to initiate video generation' });
    }

    res.json({ operationId });
  } catch (error) {
    console.error('Error initiating video generation:', error);
  }
});

app.get('/api/veo/status/:operationId', async (req, res) =
  try {
    const { operationId } = req.params;
    const response = await axios.get(
      `https://${process.env.GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/${operationId}`,
      {
        headers: {
          Authorization: `Bearer ${await vertexAI.getAccessToken()}`,
        },
      }
    );

    const { done, response: opResponse, error } = response.data;
    const status = done
      ? opResponse
        ? 'SUCCEEDED'
        : 'FAILED'
      : 'RUNNING';
    const jobDetails = {
      id: `job_${Date.now()}`,
      operationId,
      status,
    };

    res.json(jobDetails);
  } catch (error) {
    console.error('Error fetching video status:', error);
  }
});

app.post('/api/veo/cancel/:operationId', async (req, res) =
  try {
    const { operationId } = req.params;
    await axios.post(
      `https://${process.env.GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/${operationId}:cancel`,
      {},
      {
        headers: {
          Authorization: `Bearer ${await vertexAI.getAccessToken()}`,
        },
      }
    );
    res.status(200).json({ message: 'Cancellation requested' });
  } catch (error) {
    console.error('Error cancelling video generation:', error);
  }
});

app.listen(PORT, () =
  console.log(`Server running on port ${PORT}`);
});

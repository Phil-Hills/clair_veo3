import { VideoGenerationParams, VideoJobDetails, AiServiceError } from '../types';

  const response = await fetch('/api/veo/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const errorData = await response.json();
  }
  return response.json();
};

  const response = await fetch(`/api/veo/status/${operationId}`);
  if (!response.ok) {
    const errorData = await response.json();
  }
  return response.json();
};

  const response = await fetch(`/api/veo/cancel/${operationId}`, { method: 'POST' });
  if (!response.ok) {
    const errorData = await response.json();
  }
};


import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VideoJobDetails, AiServiceError, VideoGenerationParams, OperationStatus } from './types';
import { initiateVideoGeneration, fetchVideoStatus, cancelVideoGeneration } from './services/aiService';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorDisplay from './components/ErrorDisplay';
import { 
  ASPECT_RATIOS, 
  DEFAULT_ASPECT_RATIO, 
  DEFAULT_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  MAX_DURATION_SECONDS,
  DEFAULT_GENERATE_AUDIO,
  SIMULATED_PROGRESS_INTERVAL_MS // Keep for polling interval, backend drives actual progress
} from './constants';

const App: React.FC = () => {
  const [currentJob, setCurrentJob] = useState<VideoJobDetails | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [initialImage, setInitialImage] = useState<{file: File, base64: string, mimeType: string} | null>(null);
  
  // VEO-3 Parameters
  const [aspectRatio, setAspectRatio] = useState<typeof ASPECT_RATIOS[number]>(DEFAULT_ASPECT_RATIO);
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION_SECONDS);
  const [generateAudio, setGenerateAudio] = useState<boolean>(DEFAULT_GENERATE_AUDIO);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetchingStatus, setIsFetchingStatus] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearPollingInterval = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Effect to poll for status if an operation is running
  useEffect(() => {
    if (currentJob && currentJob.operationId && (currentJob.status === "RUNNING" || currentJob.status === "GENERATING")) {
      clearPollingInterval(); // Clear existing interval before starting a new one
      const intervalId = setInterval(async () => {
        if (isFetchingStatus) return; // Prevent overlapping calls
        setIsFetchingStatus(true);
        setError(null);
        try {
          const updatedJob = await fetchVideoStatus(currentJob.operationId!);
          setCurrentJob(updatedJob);
          if (updatedJob.status === "SUCCEEDED" || updatedJob.status === "FAILED") {
            clearPollingInterval();
            setIsLoading(false); 
          }
        } catch (e: any) {
          setError(e.message || "Failed to fetch video status from backend.");
          clearPollingInterval();
          setIsLoading(false); // Stop general loading on fetch error too
        } finally {
          setIsFetchingStatus(false);
        }
      }, SIMULATED_PROGRESS_INTERVAL_MS * 2.5); // Polling interval
      pollingIntervalRef.current = intervalId;
    } else {
      clearPollingInterval(); // Clear if job is not in a pollable state
    }
    // Cleanup function for when component unmounts or dependencies change
    return () => {
      clearPollingInterval();
    };
  }, [currentJob, clearPollingInterval, isFetchingStatus]);


  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Please upload a valid image file (JPEG, PNG, GIF, WEBP).");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setInitialImage({
            file,
            base64: reader.result as string,
            mimeType: file.type
        });
        setError(null);
      };
      reader.onerror = () => {
        setError("Failed to read the image file.");
      }
      reader.readAsDataURL(file);
    }
  };

  const handleInitiateVideo = async () => {
    if (!currentPrompt.trim()) {
      setError("Prompt cannot be empty.");
      return;
    }
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setCurrentJob(null); 
    clearPollingInterval();

    const params: VideoGenerationParams = {
      prompt: currentPrompt,
      imageBase64: initialImage?.base64 || null,
      mimeType: initialImage?.mimeType || null,
      aspectRatio,
      durationSeconds: duration,
      generateAudio,
    };

    try {
      const { operationId } = await initiateVideoGeneration(params);
      setCurrentJob({
        ...params,
        id: `job_${Date.now()}`,
        operationId,
        status: "GENERATING",
        videoBase64: null,
        errorMessage: null,
        progress: 0,
      });
      // isLoading remains true, will be set to false when polling resolves
    } catch (e: any) {
      const err = e as AiServiceError;
      setError(err.message || "Failed to initiate video generation via backend.");
      setIsLoading(false);
    }
  };
  
  const handleFetchStatusManual = async () => {
    if (!currentJob || !currentJob.operationId || isLoading || isFetchingStatus) return;
    
    setIsFetchingStatus(true); // Use dedicated fetching status
    setError(null);
    try {
      const updatedJob = await fetchVideoStatus(currentJob.operationId);
      setCurrentJob(updatedJob);
      if (updatedJob.status === "SUCCEEDED" || updatedJob.status === "FAILED") {
        clearPollingInterval();
        setIsLoading(false); 
      }
    } catch (e: any) {
      setError(e.message || "Failed to fetch video status from backend.");
      // Don't clear polling interval here if it might still be running for auto-fetch
    } finally {
      setIsFetchingStatus(false);
    }
  };


  const handleClearJob = async () => {
    if (currentJob && currentJob.operationId && (currentJob.status === "RUNNING" || currentJob.status === "GENERATING")) {
        setIsLoading(true);
        setError(null);
        try {
            await cancelVideoGeneration(currentJob.operationId);
             // Backend should handle the actual cancellation. Frontend reflects by clearing.
        } catch (e: any) {
            setError(`Failed to request cancellation from backend: ${e.message}. Clearing job locally.`);
        } finally {
            setIsLoading(false);
        }
    }
    clearPollingInterval();
    setCurrentJob(null);
    setCurrentPrompt('');
    setInitialImage(null);
    setAspectRatio(DEFAULT_ASPECT_RATIO);
    setDuration(DEFAULT_DURATION_SECONDS);
    setGenerateAudio(DEFAULT_GENERATE_AUDIO);
    setError(null);
    setIsLoading(false);
    setIsFetchingStatus(false);
  };

  const clearError = () => setError(null);
  
  const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
      <path fillRule="evenodd" d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm6.39-2.908a.75.75 0 0 1 .766.027l3.5 2.25a.75.75 0 0 1 0 1.262l-3.5 2.25A.75.75 0 0 1 8 12.25v-4.5a.75.75 0 0 1 .39-.658Z" clipRule="evenodd" />
    </svg>
  );

  const RefreshIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
      <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.204 4.352l-.23.172A.75.75 0 0 1 5 15.424V13.5a.75.75 0 0 1 1.085-.686l.204.153A4 4 0 0 0 13.75 12c0-2.21-1.79-4-4-4S5.75 9.79 5.75 12H5a.75.75 0 0 1-.64-.417l-.23-.496a5.5 5.5 0 0 1 9.54-3.008L14.5 7.5h1.75a.75.75 0 0 1 .53 1.28l-1.47 1.471a.751.751 0 0 1-.002.005A5.503 5.503 0 0 1 15.312 11.424Z" clipRule="evenodd" />
    </svg>
  );

  const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75V4.5h8V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4.5h3.75V3.75c0-.69-.56-1.25-1.25-1.25H11V4.5h-.25V2.5h-.5V4.5h-.25V2.5h-.5V4.5H6V3.75c0-.69.56-1.25 1.25-1.25h.005L6 2.5ZM2.22 5.056a.75.75 0 0 0-.992 1.138A7.5 7.5 0 0 0 10 15.5a7.499 7.499 0 0 0 8.772-9.306a.75.75 0 0 0-.992-1.138 6 6 0 0 1-15.56 0Z" clipRule="evenodd" />
    </svg>
  );

  const FilmIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mx-auto mb-4 text-gray-500">
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" />
    </svg>
  );


  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-900 text-gray-100 p-4 md:p-6 space-y-4 md:space-y-0 md:space-x-6">
      {/* Control Panel */}
      <div className="md:w-1/3 lg:w-1/4 bg-gray-800 p-6 rounded-xl shadow-2xl space-y-6 flex flex-col">
        <h1 className="text-3xl font-bold text-center text-primary-400">VEO-3 MP4 Maker</h1>
        
        {error && <ErrorDisplay message={error} onClear={clearError} />}

        {/* Prompt Input */}
        <div className="space-y-2">
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-300">Video Prompt</label>
          <textarea
            id="prompt"
            rows={4}
            className="w-full bg-gray-700 text-gray-100 p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="e.g., A majestic dragon flying over a futuristic city..."
            value={currentPrompt}
            onChange={(e) => setCurrentPrompt(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {/* Initial Image Upload */}
        <div className="space-y-2">
            <label htmlFor="initial-image-upload" className="block text-sm font-medium text-gray-300">
                Initial Image (Optional)
            </label>
            <input 
                type="file" 
                id="initial-image-upload"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleImageUpload}
                disabled={isLoading}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700 disabled:opacity-50"
            />
            {initialImage && (
                <div className="mt-2 text-xs text-gray-400">
                    Selected: {initialImage.file.name} ({ (initialImage.file.size / 1024).toFixed(2)} KB)
                    <img src={initialImage.base64} alt="Preview" className="mt-2 rounded max-h-20 object-contain"/>
                </div>
            )}
        </div>


        {/* VEO-3 Parameters */}
        <div className="space-y-4 border-t border-gray-700 pt-4">
          <h3 className="text-lg font-semibold text-gray-200">Video Parameters</h3>
          <div>
            <label htmlFor="aspectRatio" className="block text-sm font-medium text-gray-300">Aspect Ratio</label>
            <select
              id="aspectRatio"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as typeof ASPECT_RATIOS[number])}
              disabled={isLoading}
              className="w-full bg-gray-700 text-gray-100 p-2 mt-1 rounded-md border border-gray-600 focus:ring-primary-500 focus:border-primary-500"
            >
              {ASPECT_RATIOS.map(ar => <option key={ar} value={ar}>{ar}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-300">Duration ({duration} seconds)</label>
            <input
              type="range"
              id="duration"
              min={MIN_DURATION_SECONDS}
              max={MAX_DURATION_SECONDS}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={isLoading}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500 mt-1"
            />
          </div>
          <div className="flex items-center">
            <input
              id="generateAudio"
              type="checkbox"
              checked={generateAudio}
              onChange={(e) => setGenerateAudio(e.target.checked)}
              disabled={isLoading}
              className="h-4 w-4 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="generateAudio" className="ml-2 text-sm font-medium text-gray-300">Generate Audio</label>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-3 border-t border-gray-700 pt-4">
          <button
            onClick={handleInitiateVideo}
            disabled={isLoading || !currentPrompt.trim()}
            className="w-full flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 px-4 rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && (currentJob?.status === "GENERATING" || currentJob?.status === "RUNNING") ? <LoadingSpinner size="w-5 h-5 mr-2" /> : <PlayIcon />}
            Generate Video
          </button>

           <button
            onClick={handleFetchStatusManual}
            disabled={isLoading || isFetchingStatus || !currentJob || !currentJob.operationId || currentJob.status === "SUCCEEDED" || currentJob.status === "FAILED"}
            className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFetchingStatus ? <LoadingSpinner size="w-5 h-5 mr-2" /> : <RefreshIcon />}
            Fetch Video Status
          </button>

          <button
            onClick={handleClearJob}
            disabled={isLoading && (currentJob?.status === "GENERATING" || currentJob?.status === "RUNNING")}
            className="w-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-md transition-colors duration-150 disabled:opacity-50"
          >
            <TrashIcon />
            Clear Job / Reset
          </button>
        </div>
        <div className="text-xs text-gray-500 pt-4 border-t border-gray-700">
          <p><strong>Note:</strong> This UI now attempts to connect to a backend at <code>/api/veo/*</code> for VEO-3 video generation. You will need to implement this backend.</p>
        </div>

      </div>

      {/* Video Display & Status */}
      <div className="md:w-2/3 lg:w-3/4 bg-gray-800 p-6 rounded-xl shadow-2xl flex flex-col items-center justify-center">
        {!currentJob && (
          <div className="text-center text-gray-500">
            <FilmIcon />
            <p className="text-xl mt-2">Video generation status will appear here.</p>
            <p>Enter a prompt and parameters, then click "Generate Video".</p>
          </div>
        )}

        {currentJob && (
          <div className="w-full max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-gray-200 mb-3">Video Generation Status</h2>
            <div className="bg-gray-700 p-4 rounded-lg space-y-2 mb-4 text-sm">
              <p><strong className="text-gray-400">Prompt:</strong> {currentJob.prompt}</p>
              <p><strong className="text-gray-400">Operation ID:</strong> {currentJob.operationId || "Not yet initiated"}</p>
              <p><strong className="text-gray-400">Status:</strong> 
                <span className={`font-semibold ml-1 ${
                  currentJob.status === "SUCCEEDED" ? "text-green-400" :
                  currentJob.status === "FAILED" ? "text-red-400" :
                  "text-yellow-400"
                }`}>
                  {currentJob.status.replace("_", " ")}
                </span>
              </p>
              {(currentJob.status === "RUNNING" || currentJob.status === "GENERATING") && currentJob.progress !== undefined && (
                 <div className="w-full bg-gray-600 rounded-full h-2.5 dark:bg-gray-700">
                    <div 
                        className="bg-primary-500 h-2.5 rounded-full transition-all duration-300" 
                        style={{width: `${currentJob.progress}%`}}>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{currentJob.progress}% complete</p>
                 </div>
              )}
            </div>

            {isLoading && (currentJob.status === "GENERATING" || currentJob.status === "RUNNING") && (
              <div className="my-6">
                <LoadingSpinner size="w-12 h-12" />
                <p className="mt-2 text-gray-400">
                    {currentJob.status === "GENERATING" && "Initiating generation via backend..."}
                    {currentJob.status === "RUNNING" && `Processing via backend... (${currentJob.progress || 0}%)`}
                </p>
              </div>
            )}
             {isFetchingStatus && (
              <div className="my-6">
                <LoadingSpinner size="w-12 h-12" />
                <p className="mt-2 text-gray-400">Fetching latest status from backend...</p>
              </div>
            )}


            {currentJob.status === "SUCCEEDED" && currentJob.videoBase64 && (
              <div className="mt-4">
                <h3 className="text-xl font-semibold text-green-400 mb-2">Video Ready</h3>
                <video controls className="w-full rounded-lg shadow-md" src={currentJob.videoBase64}>
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
            
            {currentJob.status === "SUCCEEDED" && !currentJob.videoBase64 && (
                 <div className="mt-4 text-yellow-400">
                    <p>Generation Succeeded, but no video data was returned by the backend, or the video URL is missing.</p>
                 </div>
            )}

            {currentJob.status === "FAILED" && currentJob.errorMessage && (
              <div className="mt-4">
                 <ErrorDisplay message={`Generation Failed: ${currentJob.errorMessage}`} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

import React, { useState, useRef } from 'react';
import { Upload, Video, Sparkles, AlertCircle, Loader2, Play } from 'lucide-react';
import { generateVeoVideo } from '../services/geminiService';
import { VideoGenerationState } from '../types';

const VeoCreator: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [state, setState] = useState<VideoGenerationState>({
    isGenerating: false,
    progress: '',
    videoUri: null,
    error: null,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setState(prev => ({ ...prev, error: null })); // Clear error on new file
    }
  };

  const handleGenerate = async () => {
    // 1. Check for API Key selection (Required for Veo)
    if (window.aistudio) {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
          return;
        }
      } catch (e) {
        console.error("Error checking or selecting API key:", e);
      }
    }

    // 2. Validation
    if (!file) {
      setState(prev => ({ ...prev, error: "Please upload an image first." }));
      return;
    }

    setState({ isGenerating: true, progress: 'Initializing...', videoUri: null, error: null });

    try {
      // 3. Generate
      const uri = await generateVeoVideo(file, prompt, aspectRatio);
      setState({
        isGenerating: false,
        progress: 'Done!',
        videoUri: uri,
        error: null
      });
    } catch (err: any) {
      console.error(err);
      
      // 4. Handle Specific API Key Error
      // If the API returns "Requested entity was not found", it often means the selected key 
      // is invalid or missing for the project. We prompt the user to select again.
      if (window.aistudio && err.message && err.message.includes("Requested entity was not found")) {
         try {
           await window.aistudio.openSelectKey();
           setState({
             isGenerating: false,
             progress: '',
             videoUri: null,
             error: "Session refreshed. Please click Generate again."
           });
           return;
         } catch (keyErr) {
           console.error("Failed to open key selector", keyErr);
         }
      }

      setState({
        isGenerating: false,
        progress: '',
        videoUri: null,
        error: err.message || "Failed to generate video. Please try again."
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 tracking-tight">Veo Animate Studio</h2>
        <p className="text-gray-500 mt-1 font-light">Bring your study diagrams or notes to life with AI video generation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Controls */}
        <div className="space-y-6">
          
          {/* File Upload Card */}
          <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">1. Upload Image</h3>
            <div 
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                file ? 'border-mint-300 bg-mint-50/30' : 'border-gray-200 hover:border-mint-200 hover:bg-gray-50'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*"
              />
              {file ? (
                <>
                  <div className="w-16 h-16 mb-3 rounded-lg overflow-hidden shadow-sm">
                    <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-mint-600 font-medium truncate max-w-xs">{file.name}</p>
                  <p className="text-xs text-gray-400 mt-1">Click to change</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-mint-100 text-mint-500 rounded-full flex items-center justify-center mb-3">
                    <Upload size={24} />
                  </div>
                  <p className="text-gray-600 font-medium">Click to upload image</p>
                  <p className="text-xs text-gray-400 mt-1">Supports PNG, JPG (Max 10MB)</p>
                </>
              )}
            </div>
          </div>

          {/* Configuration Card */}
          <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">2. Animation Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Prompt (Optional)</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe how the image should move (e.g., 'Make the water flow', 'Zoom in slowly')..."
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-mint-300 focus:ring-1 focus:ring-mint-300 outline-none resize-none text-sm"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Aspect Ratio</label>
                <div className="flex gap-3">
                  {(['16:9', '9:16'] as const).map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all ${
                        aspectRatio === ratio 
                          ? 'bg-mint-50 border-mint-300 text-mint-700' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {ratio === '16:9' ? 'Landscape (16:9)' : 'Portrait (9:16)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={handleGenerate}
                disabled={state.isGenerating || !file}
                className={`w-full py-4 rounded-xl font-medium text-white shadow-md flex items-center justify-center gap-2 transition-all ${
                  state.isGenerating || !file 
                    ? 'bg-gray-300 cursor-not-allowed shadow-none' 
                    : 'bg-mint-300 hover:bg-mint-400 shadow-mint-200'
                }`}
              >
                {state.isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generate Video
                  </>
                )}
              </button>
              {window.aistudio && (
                  <p className="text-[10px] text-gray-400 text-center mt-2">
                    Key selection handled by AI Studio. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-mint-500">Billing info</a>
                  </p>
              )}
            </div>
            
            {state.error && (
              <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl flex items-start gap-3 text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p>{state.error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="flex flex-col h-full">
           <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6 flex-1 flex flex-col">
              <h3 className="font-semibold text-gray-800 mb-4">3. Result</h3>
              
              <div className="flex-1 bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden relative flex items-center justify-center min-h-[400px]">
                {state.videoUri ? (
                  <video 
                    src={state.videoUri} 
                    controls 
                    autoPlay 
                    loop 
                    className="w-full h-full object-contain"
                  />
                ) : state.isGenerating ? (
                  <div className="text-center p-8">
                    <div className="w-16 h-16 bg-mint-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <Video className="text-mint-300" size={32} />
                    </div>
                    <h4 className="text-gray-800 font-medium animate-pulse">Creating magic...</h4>
                    <p className="text-gray-400 text-sm mt-2 max-w-xs mx-auto">This usually takes about 1-2 minutes. We're processing your video on the cloud.</p>
                  </div>
                ) : (
                   <div className="text-center p-8">
                     <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Play className="text-gray-300 ml-1" size={32} />
                     </div>
                     <p className="text-gray-400">Your generated video will appear here.</p>
                   </div>
                )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default VeoCreator;
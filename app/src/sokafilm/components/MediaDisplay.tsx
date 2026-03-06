import React, { useState, useEffect } from 'react';
import { useQuery } from 'wasp/client/operations';
import { getFileByUuid, getFileGenerationStatus } from 'wasp/client/operations';
import { Card, CardContent } from '../../client/components/ui/card';
import { Button } from '../../client/components/ui/button';
import { Image, Play, Volume2, FileImage, FileAudio, FileVideo, File, Download, AlertCircle, X } from 'lucide-react';
import { ImageGalleryDialog, ImageItem } from '../../client/components/ui/ImageGalleryDialog';
import toast from 'react-hot-toast';

function FailedMediaDisplay({ errorMessage }: { errorMessage?: string }) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="relative flex items-center justify-center bg-red-50 rounded-lg p-3">
      <button
        onClick={() => setShowDetail(!showDetail)}
        className="flex items-center gap-1.5 text-red-500 hover:text-red-700 transition-colors"
        title={errorMessage || 'Generation failed'}
      >
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span className="text-xs font-medium">Failed</span>
      </button>
      {showDetail && errorMessage && (
        <div className="absolute z-20 top-full left-0 mt-1 w-64 bg-white border border-red-200 rounded-lg shadow-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-red-700 break-words">{errorMessage}</p>
            <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface MediaDisplayProps {
  fileUuid: string | null | undefined;
  fileType?: string;
  alt?: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
  fallbackText?: string;
}

export function MediaDisplay({ 
  fileUuid, 
  fileType, 
  alt = 'Media content', 
  className = '',
  fallbackIcon,
  fallbackText
}: MediaDisplayProps) {

  if (!fileUuid) {
    // Determine default fallback text based on fileType
    const getDefaultFallbackText = () => {
      if (fileType === 'audio') return 'No audio';
      if (fileType === 'video') return 'No video';
      if (fileType === 'image') return 'No image';
      return 'No media';
    };

    const defaultText = fallbackText || getDefaultFallbackText();
    
    return (
      <div className={`flex items-center justify-center bg-muted rounded-lg p-4 ${className}`}>
        {fallbackIcon ? (
          <div className="flex flex-col items-center gap-2">
            {fallbackIcon}
            <span className="text-sm text-muted-foreground">{defaultText}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {fileType === 'audio' ? (
              <FileAudio className="h-8 w-8 text-muted-foreground" />
            ) : fileType === 'video' ? (
              <FileVideo className="h-8 w-8 text-muted-foreground" />
            ) : (
              <FileImage className="h-8 w-8 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">{defaultText}</span>
          </div>
        )}
      </div>
    );
  }

  // Get file information by UUID
  const { data: fileData, isLoading: isFileLoading, refetch: refetchFile } = useQuery(getFileByUuid, { uuid: fileUuid });
  const file = fileData as any; // Type assertion to handle fileUrl property

  // Get file generation status for async files (enable when file might still be generating)
  const { data: statusData, refetch: refetchStatus } = useQuery(
    getFileGenerationStatus,
    { fileUuid },
    { enabled: !!fileUuid && !!file && (file.status === 'pending' || file.status === 'queued' || file.status === 'generating') }
  );

  // When status poll says completed, use its fileUrl so image shows without waiting for getFileByUuid refetch
  const effectiveStatus = (statusData?.status === 'completed' ? 'completed' : file?.status) ?? file?.status;
  const effectiveFileUrl = (statusData?.status === 'completed' && statusData?.fileUrl) ? statusData.fileUrl : file?.fileUrl;

  // Poll for status updates when file is being generated
  useEffect(() => {
    if (file && (file.status === 'pending' || file.status === 'queued' || file.status === 'generating')) {
      const interval = setInterval(() => {
        refetchStatus();
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  }, [file?.status, refetchStatus]);

  // When job completes, refetch file so getFileByUuid cache has status and fileUrl
  useEffect(() => {
    if (statusData?.status === 'completed') {
      refetchFile();
    }
  }, [statusData?.status, refetchFile]);
  
  // Determine file type from the file data or fallback to prop
  const getFileCategory = (fileType: string): 'image' | 'audio' | 'video' | 'unknown' => {
    const lowerType = fileType.toLowerCase();
    
    // Handle MIME types (e.g., "image/png", "audio/mp3")
    if (lowerType.startsWith('image/')) {
      return 'image';
    } else if (lowerType.startsWith('audio/')) {
      return 'audio';
    } else if (lowerType.startsWith('video/')) {
      return 'video';
    }
    
    // Handle file extensions (fallback for cases where only extension is provided)
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(lowerType)) {
      return 'image';
    } else if (['mp3', 'wav', 'ogg', 'aac', 'flac'].includes(lowerType)) {
      return 'audio';
    } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(lowerType)) {
      return 'video';
    }
    
    return 'unknown';
  };

  const actualFileType = file?.fileType || fileType || 'unknown';
  const fileCategory = getFileCategory(actualFileType);
  const isLoading = isFileLoading;

  // Download handler (use effectiveFileUrl when available so download works right after generation)
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the modal
    const url = effectiveFileUrl || file?.fileUrl;
    if (!url) return;
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = file.fileName || `download.${actualFileType}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download file');
    }
  };

  const renderMedia = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center bg-muted rounded-lg p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!file) {
      return (
        <div className="flex items-center justify-center bg-muted rounded-lg p-4">
          <File className="h-8 w-8 text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">File not found</span>
        </div>
      );
    }

    // Show generation status for async files
    if (effectiveStatus === 'pending' || effectiveStatus === 'queued') {
      return (
        <div className="flex flex-col items-center justify-center bg-blue-50 rounded-lg p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <span className="text-sm text-blue-700 font-medium">
            {effectiveStatus === 'pending' ? 'Preparing generation...' : 'Queued for generation...'}
          </span>
        </div>
      );
    }

    if (effectiveStatus === 'generating') {
      const progress = statusData?.progress ?? file?.progress ?? 0;
      return (
        <div className="flex flex-col items-center justify-center bg-blue-50 rounded-lg p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <span className="text-sm text-blue-700 font-medium mb-2">Generating...</span>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            ></div>
          </div>
          <span className="text-xs text-blue-600 mt-1">{Math.round(progress * 100)}%</span>
        </div>
      );
    }

    if (file?.status === 'failed') {
      return <FailedMediaDisplay errorMessage={file.errorMessage} />;
    }

    switch (fileCategory) {
      case 'image':
        if (!effectiveFileUrl) {
          return (
            <div className="flex items-center justify-center bg-muted rounded-lg p-4">
              <FileImage className="h-8 w-8 text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Image URL not available</span>
            </div>
          );
        }
        return (
          <ImageGalleryDialog
            trigger={
              <div className="cursor-pointer relative group">
                <img
                  src={effectiveFileUrl}
                  alt={alt}
                  className="w-full h-full object-cover rounded-lg"
                  onError={(e) => {
                    // Fallback to icon if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                {/* Download button overlay */}
                <Button
                  onClick={handleDownload}
                  size="sm"
                  variant="outline"
                  className="absolute -bottom-2 -right-2 h-6 w-6 p-0 rounded-full bg-white shadow-md hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Download Image"
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            }
            images={[
              {
                id: file?.uuid || 'image',
                imageUrl: effectiveFileUrl || '',
                title: file?.fileName || 'Image',
                description: file?.taskInput?.prompt || 'No description available',
                alt: alt
              }
            ]}
          />
        );
      
      case 'audio':
        if (!effectiveFileUrl) {
          return (
            <div className="flex items-center justify-center bg-muted rounded-lg p-4">
              <FileAudio className="h-8 w-8 text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Audio URL not available</span>
            </div>
          );
        }
        return (
          <div className="relative group">
            <div className="flex items-center justify-center bg-muted rounded-lg p-4">
              <audio controls className="w-full">
                <source src={effectiveFileUrl} type={`audio/${actualFileType}`} />
                Your browser does not support the audio element.
              </audio>
            </div>
            {/* Download button for audio */}
            <Button
              onClick={handleDownload}
              size="sm"
              variant="outline"
              className="absolute -bottom-2 -right-2 h-6 w-6 p-0 rounded-full bg-white shadow-md hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Download Audio"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        );
      
      case 'video':
        if (!effectiveFileUrl) {
          return (
            <div className="flex items-center justify-center bg-muted rounded-lg p-4">
              <FileVideo className="h-8 w-8 text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Video URL not available</span>
            </div>
          );
        }
        return (
          <div className="relative group">
            <video
              controls
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                // Fallback to icon if video fails to load
                const target = e.target as HTMLVideoElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            >
              <source src={effectiveFileUrl} type={`video/${actualFileType}`} />
              Your browser does not support the video element.
            </video>
            {/* Download button for video */}
            <Button
              onClick={handleDownload}
              size="sm"
              variant="outline"
              className="absolute -bottom-2 -right-2 h-6 w-6 p-0 rounded-full bg-white shadow-md hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Download Video"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        );
      
      default:
        return (
          <div className="flex items-center justify-center bg-muted rounded-lg p-4">
            <File className="h-8 w-8 text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Unsupported file type: {actualFileType}</span>
          </div>
        );
    }
  };

  return (
    <div className={`relative ${className}`}>
      {renderMedia()}
      
      {/* Fallback icon for failed media loads */}
      {fileCategory === 'image' && (
        <div className="hidden absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
          <FileImage className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      
      {fileCategory === 'video' && (
        <div className="hidden absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
          <FileVideo className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
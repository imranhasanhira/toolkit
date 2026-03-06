import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTrigger } from "./dialog";
import { Button } from "./button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface ImageItem {
  id: string;
  imageUrl: string;
  title?: string;
  description?: string;
  alt?: string;
}

interface ImageGalleryDialogProps {
  trigger: React.ReactNode;
  images: ImageItem[];
  initialImageIndex?: number;
  onClose?: () => void;
}

export const ImageGalleryDialog: React.FC<ImageGalleryDialogProps> = ({
  trigger,
  images,
  initialImageIndex = 0,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialImageIndex);
  const [isOpen, setIsOpen] = useState(false);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const goToImage = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          goToPrevious();
          break;
        case "ArrowRight":
          event.preventDefault();
          goToNext();
          break;
        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          onClose?.();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, goToNext, goToPrevious, onClose]);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialImageIndex);
    }
  }, [isOpen, initialImageIndex]);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  if (images.length === 0) {
    return null;
  }

  const currentImage = images[currentIndex];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 overflow-hidden">
        <div className="w-full h-full flex overflow-hidden">
          <div
            className="h-full flex flex-col bg-red-100"
            style={{ width: "calc(70% - 1px)", flexShrink: 0 }}
          >
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 bg-black/50 text-white hover:bg-black/70"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>

              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white hover:bg-black/70"
                    onClick={goToPrevious}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white hover:bg-black/70"
                    onClick={goToNext}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}

              <img
                src={currentImage.imageUrl}
                alt={currentImage.alt || currentImage.title || "Gallery image"}
                className={`w-full h-full object-contain transition-all ${
                  images.length > 1 ? "cursor-pointer hover:scale-105" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (images.length > 1) goToNext();
                }}
                title={images.length > 1 ? "Click to go to next image" : ""}
              />

              {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                  {currentIndex + 1} / {images.length}
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="h-24 bg-gray-100 border-t border-gray-200 p-3">
                <div className="h-full overflow-x-auto">
                  <div className="flex gap-3 h-full">
                    {images.map((image, index) => (
                      <button
                        key={image.id}
                        onClick={() => goToImage(index)}
                        className={`flex-shrink-0 h-full aspect-square rounded overflow-hidden border-2 transition-all ${
                          index === currentIndex
                            ? "border-blue-500 ring-2 ring-blue-300"
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        <img
                          src={image.imageUrl}
                          alt={image.alt || image.title || `Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className="h-full bg-blue-100 border-l border-gray-200 flex flex-col"
            style={{ width: "calc(30% + 1px)", flexShrink: 0 }}
          >
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900 break-words">
                {images.length > 1 && (
                  <div className="text-sm text-gray-500 font-normal mb-1">
                    {currentIndex + 1} / {images.length}
                  </div>
                )}
                {currentImage.title || `Image ${currentIndex + 1}`}
              </h3>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              {currentImage.description ? (
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
                  {currentImage.description}
                </p>
              ) : (
                <p className="text-gray-500 italic text-sm">
                  No description available
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

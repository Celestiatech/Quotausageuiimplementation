import { ImageIcon, VideoIcon } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";

type MediaSlotProps = {
  imageSrc?: string;
  videoSrc?: string;
  posterSrc?: string;
  alt?: string;
  className?: string;
  placeholderTitle: string;
  placeholderHint: string;
  videoControls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
};

function hasValue(value?: string) {
  return Boolean(String(value || "").trim());
}

export function MediaSlot({
  imageSrc,
  videoSrc,
  posterSrc,
  alt,
  className,
  placeholderTitle,
  placeholderHint,
  videoControls = true,
  autoPlay = false,
  loop = false,
  muted = false,
}: MediaSlotProps) {
  const cleanVideo = String(videoSrc || "").trim();
  const cleanImage = String(imageSrc || "").trim();
  const cleanPoster = String(posterSrc || "").trim();

  if (hasValue(cleanVideo)) {
    return (
      <video
        src={cleanVideo}
        poster={hasValue(cleanPoster) ? cleanPoster : undefined}
        className={className}
        controls={videoControls}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline
      />
    );
  }

  if (hasValue(cleanImage)) {
    return <ImageWithFallback src={cleanImage} alt={alt || placeholderTitle} className={className} />;
  }

  return (
    <div
      className={`${className || ""} bg-gradient-to-br from-gray-50 to-indigo-50 border-2 border-dashed border-indigo-200 flex items-center justify-center p-8`}
    >
      <div className="max-w-md text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold mb-4">
          <ImageIcon className="w-3.5 h-3.5" />
          <VideoIcon className="w-3.5 h-3.5" />
          Media Placeholder
        </div>
        <p className="text-lg font-semibold text-gray-900 mb-2">{placeholderTitle}</p>
        <p className="text-sm text-gray-600">{placeholderHint}</p>
      </div>
    </div>
  );
}

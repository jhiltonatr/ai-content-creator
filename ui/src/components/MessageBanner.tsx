interface MessageBannerProps {
  msg: string | null;
  onClose: () => void;
}

export default function MessageBanner({ msg, onClose }: MessageBannerProps) {
  if (!msg) return null;
  return (
    <div className="banner error" onClick={onClose}>
      {msg}
    </div>
  );
}
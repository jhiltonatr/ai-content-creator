interface MessageBannerProps {
  msg: string | null;
  kind?: 'error' | 'ok';
  onClose?: () => void;
}

export default function MessageBanner({ msg, kind = 'error', onClose }: MessageBannerProps) {
  if (!msg) return null;
  return (
    <div className={`banner ${kind}`} onClick={onClose}>
      {msg}
    </div>
  );
}
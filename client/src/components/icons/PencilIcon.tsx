interface PencilIconProps {
  size?: number;
  className?: string;
}

export default function PencilIcon({ size = 18, className }: PencilIconProps) {
  return (
    <span
      className={className}
      style={{ fontSize: size, lineHeight: 1 }}
      aria-hidden
    >
      ✏️
    </span>
  );
}

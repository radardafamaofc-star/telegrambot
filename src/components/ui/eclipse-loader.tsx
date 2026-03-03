interface EclipseLoaderProps {
  percentage: number;
  size?: number;
  label?: string;
}

export function EclipseLoader({ percentage, size = 160, label }: EclipseLoaderProps) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer glow ring */}
        <div 
          className="absolute inset-0 rounded-full eclipse-glow"
          style={{
            boxShadow: `0 0 ${size/4}px hsl(210 100% 55% / 0.15), 0 0 ${size/2}px hsl(210 100% 55% / 0.05)`,
          }}
        />

        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(210 100% 55% / 0.08)"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#neonGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
            style={{
              filter: 'drop-shadow(0 0 6px hsl(210 100% 55% / 0.6))',
            }}
          />
          {/* Rotating eclipse head */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(210 100% 55% / 0.15)"
            strokeWidth={strokeWidth + 2}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.08} ${circumference * 0.92}`}
            className="eclipse-loader"
            style={{ transformOrigin: 'center' }}
          />
          <defs>
            <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(210 100% 55%)" />
              <stop offset="50%" stopColor="hsl(200 100% 60%)" />
              <stop offset="100%" stopColor="hsl(230 100% 65%)" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center percentage text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span 
            className="font-display font-bold neon-text"
            style={{ fontSize: size * 0.2 }}
          >
            {percentage}%
          </span>
          {label && (
            <span className="text-muted-foreground text-[10px] uppercase tracking-widest mt-1">
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

import React from 'react'

interface StatBarProps {
    label: string
    current: number
    max: number
    showNumbers?: boolean
}

export const StatBar: React.FC<StatBarProps> = ({
    label,
    current,
    max,
    showNumbers = true,
}) => {
    const percentage = Math.min(100, (current / max) * 100)

    return (
        <div className="mb-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{label}</span>
                {showNumbers && (
                    <span className="font-mono">
                        {current} / {max}
                    </span>
                )}
            </div>
            <div className="h-5 bg-sengoku-darker border border-sengoku-border">
                <div
                    className="h-full bg-sengoku-gold transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    )
}

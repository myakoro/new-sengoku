import React from 'react'

interface PanelProps {
    title?: string
    children: React.ReactNode
    className?: string
}

export const Panel: React.FC<PanelProps> = ({ title, children, className = '' }) => {
    return (
        <div className={`bg-sengoku-dark border border-sengoku-border p-4 ${className}`}>
            {title && (
                <h3 className="text-sengoku-gold text-sm mb-3 pb-2 border-b border-sengoku-border">
                    {title}
                </h3>
            )}
            {children}
        </div>
    )
}

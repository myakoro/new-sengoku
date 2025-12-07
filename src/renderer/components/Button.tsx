import React from 'react'

interface ButtonProps {
    children: React.ReactNode
    onClick?: () => void
    variant?: 'primary' | 'secondary'
    disabled?: boolean
    className?: string
}

export const Button: React.FC<ButtonProps> = ({
    children,
    onClick,
    variant = 'primary',
    disabled = false,
    className = '',
}) => {
    const baseClasses =
        'px-8 py-4 font-bold text-lg transition-all duration-200 border-2'

    const variantClasses = {
        primary:
            'bg-sengoku-gold border-sengoku-gold text-sengoku-darker hover:bg-yellow-600 disabled:bg-gray-600 disabled:border-gray-600 disabled:text-gray-400',
        secondary:
            'bg-transparent border-sengoku-border text-sengoku-gray hover:bg-sengoku-border disabled:border-gray-700 disabled:text-gray-600',
    }

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        >
            {children}
        </button>
    )
}

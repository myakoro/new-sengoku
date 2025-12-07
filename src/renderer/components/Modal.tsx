import React from 'react'
import { Button } from './Button'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
    actions?: React.ReactNode
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    actions,
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-sengoku-dark border-2 border-sengoku-gold max-w-2xl w-full mx-4 p-6">
                <h2 className="text-2xl font-bold text-sengoku-gold mb-4">{title}</h2>
                <div className="mb-6">{children}</div>
                {actions ? (
                    <div className="flex justify-center gap-4">{actions}</div>
                ) : (
                    <div className="flex justify-center">
                        <Button onClick={onClose}>閉じる</Button>
                    </div>
                )}
            </div>
        </div>
    )
}

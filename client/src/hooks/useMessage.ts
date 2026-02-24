import { useState, useCallback } from 'react';
import type { MessageType } from '../types';

interface Message {
    text: string;
    type: MessageType;
}

export const useMessage = () => {
    const [message, setMessage] = useState<Message | null>(null);

    const showMessage = useCallback((text: string, type: MessageType) => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 8000);
    }, []);

    const clearMessage = useCallback(() => {
        setMessage(null);
    }, []);

    return { message, showMessage, clearMessage };
};

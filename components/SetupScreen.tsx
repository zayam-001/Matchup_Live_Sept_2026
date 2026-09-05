import React from 'react';
import { CheckCircle } from 'lucide-react';

export const SetupScreen: React.FC = () => {
    return (
        <div className="min-h-screen bg-surface-ground flex items-center justify-center p-4">
            <div className="text-center">
                <CheckCircle className="w-16 h-16 text-brand mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-white">System Configured</h1>
                <p className="text-content-secondary">Database connection established.</p>
            </div>
        </div>
    );
};

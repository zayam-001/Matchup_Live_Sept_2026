import React from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import { Card } from './ui/Card';

export const PrivacyPolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto pb-20">
      <button 
        onClick={onBack} 
        className="mb-6 text-sm text-content-muted hover:text-white flex items-center gap-1 transition-colors"
      >
        <ArrowLeft size={16} /> Back to App
      </button>

      <Card variant="panel" className="p-8 md:p-12 shadow-2xl">
        <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-8">
            <div className="h-12 w-12 bg-brand/20 rounded-xl flex items-center justify-center text-brand">
                <Shield size={24} />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
                <p className="text-content-secondary text-sm mt-1">Effective Date: October 26, 2023</p>
            </div>
        </div>

        <div className="prose prose-invert max-w-none text-content-secondary space-y-8 leading-relaxed">
            <p>
                This Privacy Policy describes how our WhatsApp-based AI booking agent (the "Service") collects, uses, and protects your personal information when you interact with our automated booking system for sports club hourly slot reservations.
            </p>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">1. Information We Collect</h2>
                <h3 className="text-lg font-semibold text-white mb-2">1.1 Information You Provide</h3>
                <ul className="list-disc pl-5 space-y-1 mb-4">
                    <li>Your WhatsApp phone number</li>
                    <li>Your name (if provided during booking)</li>
                    <li>Booking details (date, time, sport type, number of participants)</li>
                    <li>Payment information (processed through secure third-party payment processors)</li>
                    <li>Messages and communications sent to the AI agent</li>
                </ul>
                <h3 className="text-lg font-semibold text-white mb-2">1.2 Automatically Collected Information</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Message metadata (timestamps, delivery status)</li>
                    <li>Interaction patterns with the AI agent</li>
                    <li>Technical information (WhatsApp webhook data, session information)</li>
                </ul>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">2. How We Use Your Information</h2>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Process and manage your sports club bookings</li>
                    <li>Send booking confirmations, reminders, and updates</li>
                    <li>Respond to your inquiries and customer service requests</li>
                    <li>Improve our AI agent's performance and accuracy</li>
                    <li>Prevent fraud and ensure security of the booking system</li>
                    <li>Comply with legal obligations and enforce our terms of service</li>
                    <li>Analyze usage patterns to optimize service availability</li>
                </ul>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">3. Information Sharing and Disclosure</h2>
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-1">3.1 Sports Club Owners</h3>
                        <p>Your booking information is shared with the sports club where you make reservations to facilitate your booking and ensure service delivery.</p>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-1">3.2 Service Providers</h3>
                        <p>We work with third-party service providers:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Meta Platforms, Inc. (WhatsApp Business API provider)</li>
                            <li>AI and cloud hosting providers for service operation</li>
                            <li>Payment processors for handling transactions</li>
                            <li>Analytics and customer support service providers</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-1">3.3 Legal Requirements</h3>
                        <p>We may disclose your information if required by law, court order, or governmental authority, or to protect our rights, property, or safety.</p>
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">4. Meta WhatsApp Platform</h2>
                <p>Our Service operates on the Meta WhatsApp Business Platform. Your use of WhatsApp is governed by Meta's Privacy Policy and WhatsApp Terms of Service. We receive data through WhatsApp webhooks as permitted by Meta's platform policies. WhatsApp messages are end-to-end encrypted between you and our business account.</p>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">5. Data Retention</h2>
                <p>We retain your personal information for as long as necessary to provide the Service and fulfill the purposes outlined in this Privacy Policy. Booking records are typically retained for 2 years for business and legal compliance purposes. You may request deletion of your data subject to legal retention requirements.</p>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">6. Data Security</h2>
                <p>We implement appropriate technical and organizational security measures to protect your information, including encryption, secure webhook endpoints, access controls, and regular security assessments. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">7. Your Rights</h2>
                <p>Depending on your location, you may have the following rights:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li><strong>Access:</strong> Request access to your personal information</li>
                    <li><strong>Correction:</strong> Request correction of inaccurate information</li>
                    <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                    <li><strong>Opt-out:</strong> Opt-out of marketing communications</li>
                    <li><strong>Data Portability:</strong> Request a copy of your data in a portable format</li>
                    <li><strong>Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
                </ul>
                <p className="mt-2">To exercise these rights, please contact us at support@matchup.com.</p>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">8. International Data Transfers</h2>
                <p>Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place for international data transfers in compliance with applicable data protection laws.</p>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">9. Children's Privacy</h2>
                <p>Our Service is not intended for individuals under the age of 13 (or the applicable age of digital consent in your jurisdiction). We do not knowingly collect personal information from children. If we become aware of such collection, we will take steps to delete the information.</p>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">10. AI Processing</h2>
                <p>Our Service uses artificial intelligence to understand and respond to your messages, process bookings, and provide customer support. Your messages may be analyzed by AI systems to improve service quality and accuracy. We implement measures to ensure AI processing respects your privacy and data protection rights.</p>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">11. Cookies and Tracking Technologies</h2>
                <p>As a WhatsApp-based service, we do not use traditional cookies. However, we may use similar tracking technologies through webhooks and session management to maintain conversation context and improve user experience.</p>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">12. Changes to This Privacy Policy</h2>
                <p>We may update this Privacy Policy periodically. We will notify you of material changes by sending a message through WhatsApp or by updating the effective date. Your continued use of the Service after changes constitutes acceptance of the updated policy.</p>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">13. Contact Information</h2>
                <div className="bg-surface-ground p-6 rounded-xl border border-white/10">
                    <p className="mb-1"><span className="text-content-secondary">Email:</span> support@matchup.com</p>
                    <p className="mb-1"><span className="text-content-secondary">Business Name:</span> Match Up Sports Technology</p>
                    <p className="mb-1"><span className="text-content-secondary">Address:</span> Innovation Tower, Tech District, Dubai, UAE</p>
                    <p><span className="text-content-secondary">WhatsApp Business Number:</span> +971 50 123 4567</p>
                </div>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white mb-4">14. Jurisdiction-Specific Rights</h2>
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-1">14.1 European Economic Area (EEA) and United Kingdom</h3>
                        <p>If you are located in the EEA or UK, you have additional rights under the General Data Protection Regulation (GDPR), including the right to lodge a complaint with your local data protection authority.</p>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-1">14.2 California Residents</h3>
                        <p>California residents have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected, sold, or disclosed, and the right to opt-out of sale of personal information. We do not sell personal information.</p>
                    </div>
                </div>
            </section>
        </div>
      </Card>
    </div>
  );
};
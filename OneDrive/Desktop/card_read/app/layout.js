import './globals.css';

export const metadata = {
  title: 'VisionHire AI — AI-Powered Technical Interviews',
  description: 'Conduct intelligent, adaptive technical interviews powered by AI. Automated evaluation, proctoring, and hiring recommendations.',
  keywords: ['AI interview', 'hiring platform', 'technical interview', 'automated hiring'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

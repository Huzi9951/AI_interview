import './globals.css';

export const metadata = {
  title: 'HyperEval — AI-Powered Technical Interviews',
  description: 'Conduct intelligent, adaptive technical interviews powered by AI. Automated evaluation, proctoring, and hiring recommendations.',
  keywords: ['AI interview', 'hiring platform', 'technical interview', 'automated hiring'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

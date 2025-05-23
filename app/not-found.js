export default function NotFound() {
  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
      <h1>404 - Page Not Found</h1>
      <p>The requested page could not be found.</p>
      <p>
        <a href="/" style={{ color: '#ff6347', textDecoration: 'none' }}>
          Return to Home
        </a>
      </p>
    </div>
  );
} 
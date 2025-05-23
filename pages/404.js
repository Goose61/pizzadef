export default function Custom404() {
  return (
    <div style={{ textAlign: 'center', padding: '50px 20px' }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <a href="/" style={{ 
        display: 'inline-block', 
        marginTop: '20px',
        padding: '10px 20px',
        backgroundColor: '#ff6600',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '5px'
      }}>
        Return to Pizza Game
      </a>
    </div>
  );
} 
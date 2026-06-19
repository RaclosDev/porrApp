import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function JoinRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      localStorage.setItem('pendingJoinCode', code.toUpperCase());
    }
    navigate('/mis-ligas');
  }, [code, navigate]);

  return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'white' }}>
      <p>Procesando invitación...</p>
    </div>
  );
}

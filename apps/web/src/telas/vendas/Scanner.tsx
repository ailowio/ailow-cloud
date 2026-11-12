import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Stack } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface DetectorDeCodigo {
  detect: (origem: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}

function detectorNativo(): DetectorDeCodigo | null {
  const Ctor = (globalThis as { BarcodeDetector?: new (opcoes: { formats: string[] }) => DetectorDeCodigo }).BarcodeDetector;
  if (!Ctor) return null;
  return new Ctor({ formats: ['qr_code'] });
}

/** RF-VEN-02: abre a câmera e lê o QR da etiqueta. Sem a API nativa, manda usar a busca (não puxa biblioteca). */
export function Scanner(props: { aoCodigo: (codigo: string) => void; aoFechar: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const aoCodigo = useRef(props.aoCodigo);
  aoCodigo.current = props.aoCodigo;
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const detector = detectorNativo();
    if (!detector) {
      setErro('Este aparelho não lê QR pela câmera. Use Buscar e digite o código.');
      return;
    }
    let parado = false;
    let stream: MediaStream | null = null;
    const parar = () => {
      parado = true;
      for (const faixa of stream?.getTracks() ?? []) faixa.stop();
    };
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const video = videoRef.current;
        if (!video || parado) return parar();
        video.srcObject = stream;
        await video.play();
        const ler = async () => {
          if (parado || !videoRef.current) return;
          const achados = await detector.detect(videoRef.current).catch(() => []);
          const codigo = achados[0]?.rawValue?.trim();
          if (codigo) {
            parar();
            aoCodigo.current(codigo);
            return;
          }
          requestAnimationFrame(() => void ler());
        };
        void ler();
      } catch {
        if (!parado) setErro('Não consegui abrir a câmera. Libere o acesso ou use Buscar.');
      }
    })();
    return parar;
  }, []);

  return (
    <Stack gap="md">
      {erro ? (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {erro}
        </Alert>
      ) : (
        <video ref={videoRef} muted playsInline aria-label="Câmera lendo a etiqueta" style={{ width: '100%', borderRadius: 12 }} />
      )}
      <Button h={48} variant="default" onClick={props.aoFechar}>
        Voltar ao carrinho
      </Button>
    </Stack>
  );
}

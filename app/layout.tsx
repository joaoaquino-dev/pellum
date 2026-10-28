import type { Metadata } from 'next';
export const metadata:Metadata={title:'Aura · Gestão estética',description:'Agenda, custos, estoque e resultados da sua clínica.',icons:{icon:'/favicon.svg',apple:'/apple-touch-icon.png'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body style={{margin:0}}>{children}</body></html>}

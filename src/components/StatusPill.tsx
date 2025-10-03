import { Badge } from "./ui/badge";

interface StatusPillProps {
  status: 'idle' | 'running';
}

export function StatusPill({ status }: StatusPillProps) {
  return (
    <Badge 
      variant={status === 'idle' ? 'secondary' : 'destructive'}
      className={`${
        status === 'idle' 
          ? 'bg-green-100 text-green-800 hover:bg-green-100' 
          : 'bg-red-100 text-red-800 hover:bg-red-100'
      } border-0`}
    >
      {status === 'idle' ? 'Idle' : 'Running'}
    </Badge>
  );
}
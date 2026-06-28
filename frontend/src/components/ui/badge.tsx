// ─── Badge (components/ui/badge.tsx) ─────────────────────────────────────────
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-success/20 text-green-400 border-success/30",
        warning: "border-transparent bg-warning/20 text-yellow-400 border-warning/30",
        pending: "border-transparent bg-muted text-muted-foreground",
        running: "border-transparent bg-primary/20 text-primary border-primary/30 animate-pulse",
        completed: "border-transparent bg-success/20 text-green-400 border-success/30",
        error: "border-transparent bg-destructive/20 text-red-400 border-destructive/30",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

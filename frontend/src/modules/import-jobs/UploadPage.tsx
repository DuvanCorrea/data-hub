// ─── Upload Page (modules/import-jobs/UploadPage.tsx) ────────────────────────
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileSpreadsheet, X, CheckCircle2, Loader2 } from "lucide-react";
import { importJobsService } from "./import-jobs.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TEMPLATES } from "@/lib/templates";

type UploadState = "idle" | "uploading" | "success" | "error";

export function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [state, setState] = useState<UploadState>("idle");
  const [jobId, setJobId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [template, setTemplate] = useState("DROPI_ORDER");

  const handleFile = (f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setErrorMsg("Solo se aceptan archivos .xlsx o .xls");
      return;
    }
    setFile(f);
    setErrorMsg(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleUpload = async () => {
    if (!file) return;
    setState("uploading");
    try {
      const result = await importJobsService.uploadFile(file, template);
      setJobId(result.jobId);
      setState("success");
    } catch (err: any) {
      const msg = err.response?.data?.message ?? "Error al subir el archivo";
      setErrorMsg(msg);
      setState("error");
    }
  };

  const reset = () => {
    setFile(null);
    setState("idle");
    setErrorMsg(null);
    setJobId(null);
  };

  return (
    <div className="space-y-6 max-w-xl animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Subir Archivo</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Carga un Excel de Dropi para iniciar un job de importación.
        </p>
      </div>

      {/* Success state */}
      {state === "success" && jobId && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <CheckCircle2 className="h-10 w-10 text-green-400" />
            <div className="text-center">
              <p className="font-semibold">Archivo recibido</p>
              <p className="text-sm text-muted-foreground mt-1">
                Job <span className="tabular font-mono text-foreground">#{jobId}</span> creado — el procesamiento inicia en segundos.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="default" size="sm" onClick={() => navigate("/import-jobs")}>
                Ver jobs
              </Button>
              <Button variant="outline" size="sm" onClick={reset}>
                Subir otro
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload form */}
      {state !== "success" && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Selecciona un archivo</CardTitle>
            <CardDescription>Formatos aceptados: .xlsx, .xls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo de archivo</label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {TEMPLATES.find((t) => t.id === template)?.description}
              </p>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors",
                isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
                file && "border-primary/40 bg-primary/5"
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {file ? (
                <>
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <div className="text-center">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-3 top-3 h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); reset(); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Arrastra tu archivo aquí</p>
                    <p className="text-xs text-muted-foreground">o haz clic para seleccionar</p>
                  </div>
                </>
              )}
            </div>

            {/* Error */}
            {errorMsg && (
              <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-red-400 animate-fade-in">
                {errorMsg}
              </p>
            )}

            {/* Upload button */}
            <Button className="w-full" disabled={!file || state === "uploading"} onClick={handleUpload}>
              {state === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {state === "uploading" ? "Subiendo…" : "Iniciar importación"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

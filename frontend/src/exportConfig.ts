// Shared YAML-export runner. Used by:
//   - Toolbar's "Export" button
//   - useKeyboardShortcuts (Cmd-S)
import { useStore } from "./store";
import * as api from "./api";
import { validateMappings } from "./validation";

function downloadYaml(body: string, filename: string) {
  const blob = new Blob([body], { type: "application/x-yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Run pre-export validation, build the config payload, fetch main + sidecar
 *  YAML from the backend, trigger downloads, and update the status banner.
 *  Returns true on a successful download (warnings allowed), false otherwise. */
export async function runExport(): Promise<boolean> {
  const state = useStore.getState();
  const setIkStatus = state.setIkStatus;

  const { errors, warnings } = validateMappings({
    mappings: state.mappings,
    bodyNames: state.bodyNames,
    acmKeypointNames: state.acmKeypointNames,
  });
  if (errors.length > 0) {
    setIkStatus(`Export blocked: ${errors.length} error(s). First: ${errors[0]}`);
    return false;
  }

  const pairs: Record<string, string> = {};
  for (const m of state.mappings) pairs[m.keypointName] = m.bodyName;
  const offsetMap: Record<string, [number, number, number]> = {};
  for (const o of state.offsets) offsetMap[o.keypointName] = [o.x, o.y, o.z];
  const config: Record<string, unknown> = {
    keypointModelPairs: pairs,
    keypointInitialOffsets: offsetMap,
    scaleFactor: state.scaleFactor,
    mocapScaleFactor: state.mocapScaleFactor,
    xmlPath: state.xmlPath || "",
    xmlBasename: state.xmlBasename,
    kpNames: state.acmKeypointNames,
    segmentScales: state.segmentScales,
  };
  if (state.rawTemplate) config._rawTemplate = state.rawTemplate;

  let mainBody: string;
  let sidecarBody: string | null;
  try {
    [mainBody, sidecarBody] = await Promise.all([
      api.exportConfig(config),
      api.exportUiSidecar(config),
    ]);
  } catch (e) {
    setIkStatus("Export error: " + (e as Error).message);
    return false;
  }
  downloadYaml(mainBody, "stac_retarget_config.yaml");
  if (sidecarBody) downloadYaml(sidecarBody, "stac_retarget_config.ui.yaml");
  const base = sidecarBody ? "Config + UI sidecar downloaded." : "Config downloaded.";
  setIkStatus(
    warnings.length > 0
      ? `${base} ${warnings.length} warning(s): ${warnings[0]}`
      : base,
  );
  return true;
}

import { AppLauncher } from '../../app/run/launcher';
import { Workspace } from '../../../core/workspace';

// If di still has application
if (Workspace.requireLibrary('@travetto/di').Application) {
  new AppLauncher('di').register();
}
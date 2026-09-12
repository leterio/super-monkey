import { SuperMonkey } from "./supermonkey/supermonkey";

if (window.self === window.top) {
  SuperMonkey.run();
}

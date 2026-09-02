import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { getSceneDuration, type Video } from "@vanillaskyai/video";
import { VideoPlayer, useNarration } from "@vanillaskyai/video/react";
import { createTemplateRegistry } from "@vanillaskyai/video/templates";
import { definitions } from "./templates";
import { createBrowserVoice } from "./browser-voice";
import { lesson } from "./lesson";
import "./styles.css";

const templates = createTemplateRegistry({ definitions });

/**
 * Hold every scene for as long as its line takes to say.
 *
 * Each template already declares how long its content needs to be read;
 * `getSceneDuration` takes the scene's narration into account as well, because
 * speech is slower than reading and a scene that ends mid-sentence is the thing
 * that breaks the illusion.
 */
function pacedToNarration(video: Video): Video {
  return {
    ...video,
    scenes: video.scenes.map((scene) => ({
      ...scene,
      // No template metadata here, so the narration alone decides. Pass the
      // built-in catalog entry instead and the template's own readable time
      // becomes the floor.
      timing: { ...scene.timing, fixedDuration: getSceneDuration(scene, undefined) },
    })),
  };
}

function App() {
  const [playing, setPlaying] = useState(false);
  const voice = useMemo(createBrowserVoice, []);
  const narration = useNarration({ voice });
  const paced = useMemo(() => pacedToNarration(lesson), []);

  return <main>
    <h1>What do you want to understand today?</h1>
    <p>
      A composed lesson: the scenes and the words were planned together, so the
      voice and the picture start together and stay together.
    </p>

    {playing
      ? <VideoPlayer
          video={paced}
          templates={templates}
          orientation="landscape"
          autoPlay
          onSceneChange={narration.onSceneChange}
          ariaLabel="The lesson"
        />
      : <button onClick={() => setPlaying(true)}>Explain it to me</button>}

    {playing && <p>
      <button onClick={() => narration.interrupt()} disabled={!narration.speaking}>
        {narration.speaking ? "Stop talking" : "Not speaking"}
      </button>
    </p>}

    <section aria-label="What the tutor says">
      {paced.scenes.map((scene) => <p key={scene.id}>{scene.narration}</p>)}
    </section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);

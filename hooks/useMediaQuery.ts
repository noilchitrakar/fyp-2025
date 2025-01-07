import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  //this gives the boolean weather it is in mobile view or not
  const [matches, setMatches] = useState(false); //by default it is set to false

  useEffect(() => {
    const media = window.matchMedia(query);

    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addListener(listener);

    return () => media.removeListener(listener);
  }, [matches, query]);

  return matches;
}

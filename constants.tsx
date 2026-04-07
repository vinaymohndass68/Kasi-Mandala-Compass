
import { DeityInfo } from './types';

export const DIRECTIONS: DeityInfo[] = [
  {
    name: "Indra",
    direction: "East",
    angle: 0,
    description: "Lord of Heavens and Thunder. Represents new beginnings and spiritual awakening.",
    element: "Aether / Space",
    shakti: "Aindri",
    mantra: "Om Indraya Namaha"
  },
  {
    name: "Agni",
    direction: "South-East",
    angle: 45,
    description: "Lord of Fire. Represents transformation, energy, and digestive power.",
    element: "Fire",
    shakti: "Varahi",
    mantra: "Om Agnaye Namaha"
  },
  {
    name: "Yama",
    direction: "South",
    angle: 90,
    description: "Lord of Death and Dharma. Represents discipline and the end of cycles.",
    element: "Earth",
    shakti: "Chamunda",
    mantra: "Om Yamaya Namaha"
  },
  {
    name: "Nirriti",
    direction: "South-West",
    angle: 135,
    description: "Lord of Destruction and Ancestors. Represents removal of obstacles and ego.",
    element: "Earth / Stability",
    shakti: "Nirritti Shakti",
    mantra: "Om Nirritaye Namaha"
  },
  {
    name: "Varuna",
    direction: "West",
    angle: 180,
    description: "Lord of Oceans and Cosmic Law. Represents emotions and purification.",
    element: "Water",
    shakti: "Varunani",
    mantra: "Om Varunaya Namaha"
  },
  {
    name: "Vayu",
    direction: "North-West",
    angle: 225,
    description: "Lord of Wind and Prana. Represents movement and mental clarity.",
    element: "Air",
    shakti: "Kaumari",
    mantra: "Om Vayave Namaha"
  },
  {
    name: "Kubera",
    direction: "North",
    angle: 270,
    description: "Lord of Wealth and Prosperity. Represents manifestation and abundance.",
    element: "Water / Flow",
    shakti: "Maheshwari",
    mantra: "Om Kuberaya Namaha"
  },
  {
    name: "Ishana",
    direction: "North-East",
    angle: 315,
    description: "The Aspect of Shiva. Represents ultimate knowledge and enlightenment.",
    element: "Water / Ether",
    shakti: "Brahmani",
    mantra: "Om Ishanaya Namaha"
  }
];

export const MANDALA_COLORS = {
  primary: "#fbbf24", // Amber
  secondary: "#ef4444", // Red
  accent: "#8b5cf6", // Violet
  bg: "#1e293b", // Slate
  text: "#f8fafc" // White
};

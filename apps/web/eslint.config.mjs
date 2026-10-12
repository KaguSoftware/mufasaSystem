import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**"] },
  {
    rules: {
      // Physical direction utilities break RTL. Use logical ones (ms-/me-/ps-/pe-/start-/end-).
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/(^|\s)(ml|mr|pl|pr|left|right)-/]",
          message: "Use logical Tailwind classes (ms-/me-/ps-/pe-/start-/end-) for RTL support.",
        },
      ],
    },
  },
];

export default config;

"use client";

import { useEffect } from "react";

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "PrepNexa API",
    version: "1.0.0",
    description:
      "OpenAPI specification for the real REST endpoints in the PrepNexa AI interview and resume platform.",
  },
  servers: [{ url: "http://localhost:3000" }],
  paths: {
    "/api/interview/start": {
      post: {
        summary: "Create a new interview session",
        operationId: "createInterview",
        tags: ["Interview"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["jobRole"],
                properties: {
                  jobRole: { type: "string", example: "Frontend Engineer" },
                  jobDescription: {
                    type: "string",
                    example: "Build scalable UI systems and collaborate with design teams.",
                  },
                  resumeText: {
                    type: "string",
                    example: "Senior frontend engineer with React and TypeScript experience.",
                  },
                  resumeFileName: {
                    type: "string",
                    example: "resume.pdf",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Interview created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    interviewId: { type: "string", example: "8f8b7a8a-7d2d-4c9b-87d0-8bc7a1700a87" },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Quota or usage restriction" },
          "400": { description: "Invalid request body" },
          "500": { description: "Server error" },
        },
      },
    },
    "/api/interview/respond": {
      post: {
        summary: "Submit an answer and continue the interview",
        operationId: "respondToInterview",
        tags: ["Interview"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["interviewId", "answer"],
                properties: {
                  interviewId: { type: "string", example: "8f8b7a8a-7d2d-4c9b-87d0-8bc7a1700a87" },
                  answer: { type: "string", example: "I used React hooks to build a reusable dashboard." },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Interview response processed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    nextQuestion: { type: "string", example: "Tell me about a time you improved system performance." },
                    interviewId: { type: "string", example: "8f8b7a8a-7d2d-4c9b-87d0-8bc7a1700a87" },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "400": { description: "Invalid input" },
          "500": { description: "AI processing error" },
        },
      },
    },
    "/api/resume/parse": {
      post: {
        summary: "Extract text from an uploaded PDF resume",
        operationId: "parseResumePdf",
        tags: ["Resume"],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "A PDF resume file uploaded by the user.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Resume parsed successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    text: { type: "string", example: "John Doe\nSenior Frontend Engineer" },
                    fileName: { type: "string", example: "resume.pdf" },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "400": { description: "No file provided" },
          "429": { description: "Rate limit exceeded" },
          "500": { description: "PDF parsing failed" },
        },
      },
    },
  },
};

type SwaggerUIWindow = Window & {
  SwaggerUIBundle?: (config: Record<string, unknown>) => void;
};

export default function ApiDocsPage() {
  useEffect(() => {
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.27.0/swagger-ui.css";
    document.head.appendChild(style);

    const existingScript = document.querySelector("script[src*='swagger-ui-bundle.js']");
    const swaggerWindow = window as SwaggerUIWindow;

    const renderSwagger = () => {
      if (swaggerWindow.SwaggerUIBundle) {
        swaggerWindow.SwaggerUIBundle({
          spec: openApiSpec,
          dom_id: "#swagger-ui",
          deepLinking: true,
          persistAuthorization: true,
          defaultModelsExpandDepth: 2,
          defaultModelExpandDepth: 2,
          displayRequestDuration: true,
          filter: true,
          tryItOutEnabled: true,
          supportedSubmitMethods: ["get", "put", "post", "delete", "options", "head", "patch"],
        });
      }
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.27.0/swagger-ui-bundle.js";
      script.async = true;
      script.onload = renderSwagger;
      document.body.appendChild(script);
    } else {
      renderSwagger();
    }
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#0b1020", color: "#e5e7eb" }}>
      <div id="swagger-ui" style={{ width: "100%", minHeight: "100vh" }} />
    </main>
  );
}

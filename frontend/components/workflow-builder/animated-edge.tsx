"use client";

import { type FC } from "react";
import { getBezierPath, type EdgeProps } from "reactflow";

export interface AnimatedEdgeData {
  status?: "idle" | "flowing" | "completed";
}

export const AnimatedEdge: FC<EdgeProps<AnimatedEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const status = data?.status || "idle";

  const colors = {
    idle: { stroke: "rgba(255,255,255,0.1)", width: 1.5 },
    flowing: { stroke: "rgba(99,102,241,0.7)", width: 2 },
    completed: { stroke: "rgba(34,197,94,0.5)", width: 2 },
  };

  const { stroke, width } = colors[status];

  return (
    <g>
      <path
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          stroke,
          strokeWidth: width,
          fill: "none",
          transition: "stroke 0.4s ease, stroke-width 0.4s ease",
        }}
      />

      {status === "flowing" && (
        <>
          {/* Animated dash overlay */}
          <path
            d={edgePath}
            style={{
              stroke: "rgba(99,102,241,0.25)",
              strokeWidth: 8,
              fill: "none",
              strokeDasharray: "8 4",
              strokeLinecap: "round",
            }}
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-12"
              dur="0.6s"
              repeatCount="indefinite"
            />
          </path>

          {/* Flowing particles */}
          <circle r="3.5" fill="#818CF8" opacity="0.9">
            <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="2.5" fill="#6366F1" opacity="0.5">
            <animateMotion
              dur="1.5s"
              repeatCount="indefinite"
              path={edgePath}
              begin="0.5s"
            />
          </circle>
        </>
      )}
    </g>
  );
};

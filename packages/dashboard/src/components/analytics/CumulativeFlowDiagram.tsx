"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../card"

export interface CumulativeFlowDataPoint {
  date: string
  open: number
  inProgress: number
  blocked: number
  closed: number
}

export interface CumulativeFlowDiagramProps {
  data?: CumulativeFlowDataPoint[]
  title?: string
  description?: string
}

const chartConfig = {
  closed: {
    label: "Closed",
    color: "hsl(var(--chart-4, 120 60% 50%))",
  },
  blocked: {
    label: "Blocked",
    color: "hsl(var(--chart-3, 340 75% 55%))",
  },
  inProgress: {
    label: "In Progress",
    color: "hsl(var(--chart-2, 160 60% 45%))",
  },
  open: {
    label: "Open",
    color: "hsl(var(--chart-1, 220 70% 50%))",
  },
} satisfies ChartConfig

// Generate sample cumulative flow data for the last 14 days
function generateSampleData(): CumulativeFlowDataPoint[] {
  const data: CumulativeFlowDataPoint[] = []
  const startDate = new Date("2024-12-07")

  // Simulate cumulative flow over 14 days
  for (let i = 0; i < 14; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)

    // Create realistic flow where work moves from open -> in progress -> closed
    // Total work remains relatively constant, but distribution changes
    const totalIssues = 50
    const progress = i / 13 // 0 to 1

    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      closed: Math.round(progress * 25), // Growing
      blocked: Math.max(1, Math.round(3 - progress * 2)), // Decreasing
      inProgress: Math.round(8 - progress * 3), // Decreasing
      open: Math.round(totalIssues - (progress * 25) - Math.max(1, Math.round(3 - progress * 2)) - Math.round(8 - progress * 3)),
    })
  }

  return data
}

export function CumulativeFlowDiagram({
  data = generateSampleData(),
  title = "Cumulative Flow Diagram",
  description = "Issue distribution by status over time",
}: CumulativeFlowDiagramProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 0,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              label={{ value: "Number of Issues", angle: -90, position: "insideLeft" }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey="closed"
              stackId="1"
              stroke="var(--color-closed)"
              fill="var(--color-closed)"
              fillOpacity={0.8}
            />
            <Area
              type="monotone"
              dataKey="blocked"
              stackId="1"
              stroke="var(--color-blocked)"
              fill="var(--color-blocked)"
              fillOpacity={0.8}
            />
            <Area
              type="monotone"
              dataKey="inProgress"
              stackId="1"
              stroke="var(--color-inProgress)"
              fill="var(--color-inProgress)"
              fillOpacity={0.8}
            />
            <Area
              type="monotone"
              dataKey="open"
              stackId="1"
              stroke="var(--color-open)"
              fill="var(--color-open)"
              fillOpacity={0.8}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

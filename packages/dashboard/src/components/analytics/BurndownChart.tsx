"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../card"

export interface BurndownDataPoint {
  day: string
  date: string
  remaining: number
  ideal: number
}

export interface BurndownChartProps {
  data?: BurndownDataPoint[]
  sprintName?: string
  startDate?: string
  endDate?: string
}

const chartConfig = {
  remaining: {
    label: "Remaining Issues",
    color: "hsl(var(--chart-1, 220 70% 50%))",
  },
  ideal: {
    label: "Ideal Burndown",
    color: "hsl(var(--chart-2, 160 60% 45%))",
  },
} satisfies ChartConfig

// Generate sample data for a 2-week sprint
function generateSampleData(): BurndownDataPoint[] {
  const startIssues = 20
  const data: BurndownDataPoint[] = []

  // Sprint days (10 working days)
  const sprintDays = [
    { day: "Mon 1", date: "Dec 9" },
    { day: "Tue 2", date: "Dec 10" },
    { day: "Wed 3", date: "Dec 11" },
    { day: "Thu 4", date: "Dec 12" },
    { day: "Fri 5", date: "Dec 13" },
    { day: "Mon 6", date: "Dec 16" },
    { day: "Tue 7", date: "Dec 17" },
    { day: "Wed 8", date: "Dec 18" },
    { day: "Thu 9", date: "Dec 19" },
    { day: "Fri 10", date: "Dec 20" },
  ]

  // Actual burndown (with some variation)
  const actualProgress = [20, 18, 17, 15, 13, 11, 9, 7, 4, 2]

  sprintDays.forEach((sprint, index) => {
    data.push({
      day: sprint.day,
      date: sprint.date,
      remaining: actualProgress[index],
      ideal: Math.round(startIssues - (startIssues / (sprintDays.length - 1)) * index),
    })
  })

  return data
}

export function BurndownChart({
  data = generateSampleData(),
  sprintName = "Sprint 12",
  startDate = "Dec 9",
  endDate = "Dec 20",
}: BurndownChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Burndown Chart</CardTitle>
        <CardDescription>
          {sprintName} ({startDate} - {endDate})
        </CardDescription>
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
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              label={{ value: "Remaining Issues", angle: -90, position: "insideLeft" }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <defs>
              <linearGradient id="fillRemaining" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-remaining)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-remaining)" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="remaining"
              stroke="var(--color-remaining)"
              strokeWidth={2}
              fill="url(#fillRemaining)"
            />
            <Line
              type="linear"
              dataKey="ideal"
              stroke="var(--color-ideal)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

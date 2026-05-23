import React from 'react'
import Button from '../components/ui/Button'

export default {
  title: 'UI/Button',
  component: Button
}

export const Primary = () => <Button>Primary Action</Button>
export const Ghost = () => <Button variant="ghost">Secondary</Button>

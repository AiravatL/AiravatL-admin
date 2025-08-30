'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, User, Truck } from 'lucide-react'

interface CreateUserForm {
  email: string
  password: string
  role: 'consigner' | 'driver'
  first_name: string
  last_name: string
  phone_number: string
  vehicle_type: string
  vehicle_number: string
}

export default function UsersPage() {
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<CreateUserForm>({
    email: '',
    password: '',
    role: 'consigner',
    first_name: '',
    last_name: '',
    phone_number: '',
    vehicle_type: '',
    vehicle_number: ''
  })

  const vehicleTypes = [
    'three_wheeler',
    'pickup_truck', 
    'mini_truck',
    'medium_truck',
    'large_truck'
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Create user metadata based on role
      const userMetadata: any = {
        role: form.role,
        first_name: form.first_name,
        last_name: form.last_name
      }

      if (form.role === 'driver') {
        userMetadata.phone_number = form.phone_number
        userMetadata.vehicle_type = form.vehicle_type
        userMetadata.vehicle_number = form.vehicle_number
      }

      // Create user using Supabase admin function
      const { data, error } = await supabase.auth.admin.createUser({
        email: form.email,
        password: form.password,
        email_confirm: true,
        user_metadata: userMetadata
      })

      if (error) {
        throw error
      }

      alert(`${form.role} user created successfully!`)
      setForm({
        email: '',
        password: '',
        role: 'consigner',
        first_name: '',
        last_name: '',
        phone_number: '',
        vehicle_type: '',
        vehicle_number: ''
      })
      setShowForm(false)
    } catch (error: any) {
      console.error('Error creating user:', error)
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-2">Create and manage consigners and drivers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Create New User</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({...form, email: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({...form, password: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="consigner"
                    checked={form.role === 'consigner'}
                    onChange={(e) => setForm({...form, role: e.target.value as 'consigner' | 'driver'})}
                    className="mr-2"
                  />
                  <User className="w-4 h-4 mr-1" />
                  Consigner
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="driver"
                    checked={form.role === 'driver'}
                    onChange={(e) => setForm({...form, role: e.target.value as 'consigner' | 'driver'})}
                    className="mr-2"
                  />
                  <Truck className="w-4 h-4 mr-1" />
                  Driver
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => setForm({...form, first_name: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => setForm({...form, last_name: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
            </div>

            {form.role === 'driver' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number (10 digits)
                  </label>
                  <input
                    type="tel"
                    value={form.phone_number}
                    onChange={(e) => setForm({...form, phone_number: e.target.value})}
                    className="form-input"
                    pattern="[0-9]{10}"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Type
                    </label>
                    <select
                      value={form.vehicle_type}
                      onChange={(e) => setForm({...form, vehicle_type: e.target.value})}
                      className="form-select"
                      required
                    >
                      <option value="">Select vehicle type</option>
                      {vehicleTypes.map(type => (
                        <option key={type} value={type}>
                          {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Number
                    </label>
                    <input
                      type="text"
                      value={form.vehicle_number}
                      onChange={(e) => setForm({...form, vehicle_number: e.target.value})}
                      className="form-input"
                      placeholder="KA01AB1234"
                      minLength={6}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
import React from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import Header from './Header';

// GraphQL queries for admin data
const GET_RESERVATIONS = gql`
  query GetReservations {
    reservations {
      id
      name
      email
      phone
      date
      time
      guests
      specialRequests
      status
    }
  }
`;

const GET_CONTACT_MESSAGES = gql`
  query GetContactMessages {
    contactMessages {
      id
      name
      email
      subject
      message
      timestamp
    }
  }
`;

const AdminPanel = () => {
  const { data: reservationsData, loading: reservationsLoading, error: reservationsError } = useQuery(GET_RESERVATIONS);
  const { data: messagesData, loading: messagesLoading, error: messagesError } = useQuery(GET_CONTACT_MESSAGES);

  if (reservationsLoading || messagesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (reservationsError || messagesError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-red-600">
          <p>Error loading admin data</p>
          {reservationsError && <p>Reservations: {reservationsError.message}</p>}
          {messagesError && <p>Messages: {messagesError.message}</p>}
        </div>
      </div>
    );
  }

  const reservations = reservationsData?.reservations || [];
  const messages = messagesData?.contactMessages || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="pt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-heading font-bold text-gray-900 mb-4">
              Restaurant Admin Panel
            </h1>
            <p className="text-lg text-gray-600">
              View reservations and contact messages
            </p>
          </div>

          {/* Reservations Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-heading font-semibold text-gray-900 mb-6">
              Reservations ({reservations.length})
            </h2>
            {reservations.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                No reservations yet
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reservation
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Special Requests
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reservations.map((reservation) => (
                        <tr key={reservation.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{reservation.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{reservation.email}</div>
                            <div className="text-sm text-gray-500">{reservation.phone}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{reservation.date}</div>
                            <div className="text-sm text-gray-500">{reservation.time} • {reservation.guests} guests</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs">
                              {reservation.specialRequests || 'None'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              reservation.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-800'
                                : reservation.status === 'confirmed'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {reservation.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Contact Messages Section */}
          <div>
            <h2 className="text-2xl font-heading font-semibold text-gray-900 mb-6">
              Contact Messages ({messages.length})
            </h2>
            {messages.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                No contact messages yet
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contact Info
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Subject
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Message
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Received
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {messages.map((message) => (
                        <tr key={message.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{message.name}</div>
                            <div className="text-sm text-gray-500">{message.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900 max-w-xs">
                              {message.subject}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-700 max-w-md">
                              <p className="line-clamp-3">{message.message}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(message.timestamp).toLocaleDateString()}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
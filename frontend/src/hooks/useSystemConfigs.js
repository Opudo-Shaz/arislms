import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listSystemConfigs,
  createSystemConfig,
  updateSystemConfig,
  toggleSystemConfigStatus,
  deleteSystemConfig,
} from '../api/systemConfigApi'

export const systemConfigKeys = {
  all: ['systemConfigs'],
  lists: (params) => [...systemConfigKeys.all, 'list', params ?? {}],
}

export const useSystemConfigs = (params) =>
  useQuery({
    queryKey: systemConfigKeys.lists(params),
    queryFn: () => listSystemConfigs(params),
    placeholderData: keepPreviousData,
  })

export const useCreateSystemConfig = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => createSystemConfig(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: systemConfigKeys.all }),
  })
}

export const useUpdateSystemConfig = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => updateSystemConfig(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: systemConfigKeys.all }),
  })
}

export const useToggleSystemConfigStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => toggleSystemConfigStatus(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: systemConfigKeys.all }),
  })
}

export const useDeleteSystemConfig = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => deleteSystemConfig(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: systemConfigKeys.all }),
  })
}

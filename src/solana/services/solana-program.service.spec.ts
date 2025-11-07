import { Test, TestingModule } from '@nestjs/testing';
import { address } from '@solana/kit';
import type { AccountInfoWithPubkey } from '@solana/kit';

import { SolanaAccountService } from './solana-account.service';
import { SolanaProgramService } from './solana-program.service';
import { SolanaRpcService } from './solana-rpc.service';
import { SolanaUtilsService } from './solana-utils.service';
import type { AccountInfo } from '../types';

const PROGRAM_ID = '11111111111111111111111111111111';
const OWNER_ID = 'BPFLoader1111111111111111111111111111111111';
const PROGRAM_ACCOUNT_ID = 'Account1111111111111111111111111111111111111';

const createMockRpc = (accounts: AccountInfoWithPubkey<AccountInfo>[]) => ({
  getProgramAccounts: jest.fn(() => ({
    send: jest.fn().mockResolvedValue(accounts),
  })),
});

describe('SolanaProgramService', () => {
  let service: SolanaProgramService;
  let accountServiceMock: { getAccountInfo: jest.Mock };
  let rpcServiceMock: { rpc: ReturnType<typeof createMockRpc> };
  let mockRpc: ReturnType<typeof createMockRpc>;
  let mockAccountInfo: AccountInfo;
  let programAccountsResponse: AccountInfoWithPubkey<AccountInfo>[];

  beforeEach(async () => {
    jest.clearAllMocks();

    mockAccountInfo = {
      executable: true,
      lamports: BigInt(1_000_000),
      owner: address(OWNER_ID),
      space: BigInt(256),
      data: ['AA==', 'base64'],
    } as unknown as AccountInfo;

    programAccountsResponse = [
      {
        pubkey: address(PROGRAM_ACCOUNT_ID),
        account: mockAccountInfo,
      },
    ] as AccountInfoWithPubkey<AccountInfo>[];

    mockRpc = createMockRpc(programAccountsResponse);

    accountServiceMock = {
      getAccountInfo: jest.fn().mockResolvedValue(mockAccountInfo),
    };
    rpcServiceMock = {
      get rpc() {
        return mockRpc;
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolanaProgramService,
        SolanaUtilsService,
        { provide: SolanaAccountService, useValue: accountServiceMock },
        { provide: SolanaRpcService, useValue: rpcServiceMock },
      ],
    }).compile();

    service = module.get(SolanaProgramService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns program info when the account exists', async () => {
    const info = await service.getProgramInfo(PROGRAM_ID);

    expect(info).toEqual(mockAccountInfo);
    expect(accountServiceMock.getAccountInfo).toHaveBeenCalledWith(
      expect.any(String),
    );
  });

  it('returns null when no account is found', async () => {
    accountServiceMock.getAccountInfo.mockResolvedValueOnce(null);

    const info = await service.getProgramInfo(PROGRAM_ID);

    expect(info).toBeNull();
  });

  it('throws when account service fails to retrieve program info', async () => {
    const error = new Error('Account service failure');
    accountServiceMock.getAccountInfo.mockRejectedValueOnce(error);

    await expect(service.getProgramInfo(PROGRAM_ID)).rejects.toThrow(error);
  });

  it('reports programs as deployed when the account is executable', async () => {
    const deployed = await service.isProgramDeployed(PROGRAM_ID);

    expect(deployed).toBe(true);
  });

  it('reports programs as not deployed when account info is missing', async () => {
    accountServiceMock.getAccountInfo.mockResolvedValueOnce(null);

    const deployed = await service.isProgramDeployed(PROGRAM_ID);

    expect(deployed).toBe(false);
  });

  it('reports programs as not deployed when getProgramInfo throws', async () => {
    accountServiceMock.getAccountInfo.mockRejectedValueOnce(
      new Error('Account service error'),
    );

    const deployed = await service.isProgramDeployed(PROGRAM_ID);

    expect(deployed).toBe(false);
  });

  it('returns program owned accounts from the RPC client', async () => {
    const dataSlice = { offset: 0, length: 0 };
    const accounts = await service.getProgramAccounts(PROGRAM_ID, {
      dataSlice,
    });

    expect(accounts).toEqual(programAccountsResponse);
    expect(mockRpc.getProgramAccounts).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        dataSlice,
        encoding: 'base64',
      }),
    );
  });

  it('propagates RPC errors when fetching program accounts fails', async () => {
    const rpcError = new Error('rpc failure');
    mockRpc.getProgramAccounts.mockReturnValueOnce({
      send: jest.fn().mockRejectedValue(rpcError),
    });

    await expect(service.getProgramAccounts(PROGRAM_ID)).rejects.toThrow(
      rpcError,
    );
  });

  it('returns the declared program data size', async () => {
    const space = await service.getProgramDataSize(PROGRAM_ID);

    expect(space).toBe(mockAccountInfo.space);
  });

  it('throws when requesting data size for a missing program', async () => {
    accountServiceMock.getAccountInfo.mockResolvedValueOnce(null);

    await expect(service.getProgramDataSize(PROGRAM_ID)).rejects.toThrow();
  });

  it('returns the owning program address', async () => {
    const owner = await service.getProgramOwner(PROGRAM_ID);

    expect(owner).toEqual(mockAccountInfo.owner);
  });

  it('throws when requesting owner for a missing program', async () => {
    accountServiceMock.getAccountInfo.mockResolvedValueOnce(null);

    await expect(service.getProgramOwner(PROGRAM_ID)).rejects.toThrow();
  });
});
